import {NRTSNode} from "../../common/NRTSNode";
import {Node as NodeRedNode, NodeAPI, NodeMessage} from "node-red";
import {SerialPort} from "serialport";
import {StreamFSM} from "../../common/stream";
import {FromRadioSchema, ToRadio, ToRadioSchema} from "../../generated/meshtastic/mesh_pb";
import {create, fromBinary, toJson} from "@bufbuild/protobuf";
import {MestasticSerialInNodeDef, MestasticSerialPortNodeDef} from "./types";


interface MeshtasticSerialPortDataListener {
    fromRadioIn(msg: NodeMessage): void;
}

interface MeshtaticSerialPortStatusListener {
    updateSerialPortStatus(connected: boolean): void
}

/****************************************************************************/
class MeshtasticSerialPortNode extends NRTSNode<MestasticSerialPortNodeDef> {
    private port: SerialPort;
    private parser: StreamFSM;
    private dataListeners: MeshtasticSerialPortDataListener[] = [];
    private statusListeners: MeshtaticSerialPortStatusListener[] = [];

    constructor(RED: NodeAPI, node: NodeRedNode, config: MestasticSerialPortNodeDef) {
        super(RED, node, config);

        this.parser = new StreamFSM();

        this.port = new SerialPort({
            path: config.port,
            baudRate: Number(config.baudRate),
            autoOpen: false
        });

        this.tryOpenPort();
    }

    private tryOpenPort(retries = 10, delay = 1000) {
        const attempt = (remaining: number) => {
            console.log(`Attempting to open serial port: ${this.config.port} (${remaining} retries left)`);

            this.port.open((err) => {
                if (err) {
                    if (err.message.includes("Cannot lock port") && remaining > 0) {
                        setTimeout(() => attempt(remaining - 1), delay);
                    } else {
                        this.error(`Failed to open serial port: ${err.message}`);
                    }
                    return;
                }

                this.onPortOpened();
            });
        };

        attempt(retries);
    }

    private onPortOpened() {
        console.log(`Serial port ${this.config.port} opened successfully.`);
        this.parser.reset();

        this.port.on("data", (chunk: Buffer) => this.onData(chunk));

        // Wake up the device and enter protobuf mode
        const wakeNoise = Buffer.alloc(32, 0xC3);
        this.port.write(wakeNoise, (err) => {
            if (err) {
                this.error(`Failed to send wake noise: ${err.message}`);
            }
        });

        const enableRequest: ToRadio = create(ToRadioSchema, {
            payloadVariant: {
                case: "wantConfigId",
                value: 1
            }
        });

        const framed = StreamFSM.encapsulate(enableRequest);
        this.port.write(framed, (err) => {
            if (err) {
                this.error(`Failed to send framed protobuf: ${err.message}`);
            }
        });

        for (let listener of this.statusListeners) {
            listener.updateSerialPortStatus(true);
        }
    }

    protected onData(chunk: Buffer) {
        const result = this.parser.feed(chunk);
        if (result) {
            try {
                const decoded = fromBinary(FromRadioSchema, result);

                const json = toJson(FromRadioSchema, decoded, {
                    alwaysEmitImplicit: true,
                    useProtoFieldName: true,
                    enumAsInteger: false
                });
                const msg: NodeMessage = {payload: json};

                const oneofCase = decoded.payloadVariant.case; // e.g. "packet", "myInfo", etc.

                for (const listener of this.dataListeners) {
                    listener.fromRadioIn({
                        ...msg,
                        topic: oneofCase
                    });
                }
            } catch (decodeErr: any) {
                this.error(`Failed to decode FromRadio: ${decodeErr.message || decodeErr}`);
            }
        }
    }


    protected override onClose(removed: boolean, done: (err?: Error) => void): void {
        try {
            console.log("Closed meshtastic serial port; clearing listeners");

            for (let listener of this.statusListeners) {
                listener.updateSerialPortStatus(false);
            }
            this.dataListeners = []; // Clear listeners
            this.statusListeners = [];

            if (this.port?.isOpen) {
                this.port.close((err) => {
                    done(err || undefined);
                });
            } else {
                done();
            }
        } catch (err) {
            done(err instanceof Error ? err : new Error(String(err)));
        }
    }


    registerDataListener(listener: MeshtasticSerialPortDataListener): void {
        this.dataListeners.push(listener);
    }

    registerStatusListener(listener: MeshtaticSerialPortStatusListener): void {
        this.statusListeners.push(listener);
    }
}

/****************************************************************************/
class MeshtasticSerialInNode extends NRTSNode<MestasticSerialInNodeDef>
    implements MeshtasticSerialPortDataListener, MeshtaticSerialPortStatusListener {
    protected serialPortNode?: MeshtasticSerialPortNode;

    constructor(RED: NodeAPI, node: NodeRedNode, config: MestasticSerialInNodeDef) {
        super(RED, node, config);
        process.nextTick(() => this.init(config));


    }

    private init(config: MestasticSerialInNodeDef) {

        const parent = this.getNodeTypedSafe<MeshtasticSerialPortNode>(
            config.serialConfig,
            MeshtasticSerialPortNode);

        if (parent) {
            this.serialPortNode = parent;

            if (this.serialPortNode) {
                this.serialPortNode.registerDataListener(this);
                this.serialPortNode.registerStatusListener(this);
            } else {
                this.error("No valid serial port node found.");
            }
        }
    }

    public updateSerialPortStatus(connected: boolean): void {
        if (connected) {
            this.status({fill: "green", shape: "dot", text: "connected"});
        } else {
            this.status({fill: "red", shape: "ring", text: "disconnected"});
        }
    }

    public fromRadioIn(msg: NodeMessage): void {
        if (msg.topic === "packet") {
            this.sendMany([[msg], []]); // Output 1: Packets
        } else {
            this.sendMany([[], [msg]]); // Output 2: Everything else
        }
    }
}


/****************************************************************************/
class MeshtasticSerialOutNode extends NRTSNode<MestasticSerialInNodeDef>
    implements MeshtaticSerialPortStatusListener {
    protected serialPortNode?: MeshtasticSerialPortNode;

    constructor(RED: NodeAPI, node: NodeRedNode, config: MestasticSerialInNodeDef) {
        super(RED, node, config);
    }

    public updateSerialPortStatus(connected: boolean): void {
        if (connected) {
            this.status({fill: "green", shape: "dot", text: "connected"});
        } else {
            this.status({fill: "red", shape: "ring", text: "disconnected"});
        }
    }
}

/****************************************************************************/
module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-serial-port", MeshtasticSerialPortNode);

    API.httpAdmin.get("/meshtastic/serialports", API.auth.needsPermission(""), async function (req, res) {
        try {
            const ports = await SerialPort.list();
            res.json(ports.map(p => ({path: p.path, manufacturer: p.manufacturer})));
        } catch (err) {
            if (err instanceof Error) {
                res.status(500).send(err.message);
            } else {
                res.status(500).send(err)
            }
        }
    });

    NRTSNode.registerType(API, "meshtastic-serial-in", MeshtasticSerialInNode);
    NRTSNode.registerType(API, "meshtastic-serial-out", MeshtasticSerialOutNode);
};


