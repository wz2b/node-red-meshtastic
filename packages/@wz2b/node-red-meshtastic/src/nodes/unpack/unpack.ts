import {NRTSNode} from "../../common/NRTSNode";
import {UnpackNodeDef} from "./types";
import {NodeAPI, NodeMessage, NodeMessageInFlow} from "node-red";
import {Node as NodeRedNode} from 'node-red';

class UnpackNode extends NRTSNode<UnpackNodeDef> {
    constructor(RED: NodeAPI, node: NodeRedNode, config: UnpackNodeDef) {
        super(RED, node, config);
    }

    protected override onInput(
        msg: NodeMessageInFlow,
        send: (msgs: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
        done: (err?: Error) => void
    ) {
        try {
            const buffer = msg.payload as Buffer;

            if (!Buffer.isBuffer(buffer)) {
                throw new Error("Payload is not a Buffer");
            }

            if (buffer.length < 4) {
                throw new Error("Payload too short to contain header");
            }

            const startByte = buffer[0];
            const protocolVersion = buffer[1];
            const length = buffer.readUInt16BE(2);

            if (startByte !== 0xC0) {
                throw new Error(`Unexpected start byte: 0x${startByte.toString(16)}`);
            }

            if (length !== buffer.length - 4) {
                throw new Error(`Length mismatch: expected ${length} bytes but buffer has ${buffer.length - 4}`);
            }

            const payload = buffer.subarray(4);

            send({
                _msgid: msg._msgid,
                topic: msg.topic,
                payload: {
                    protocolVersion: protocolVersion,
                    messageLength: length,
                    original: msg,
                    payload: payload
                }

            })
            done();
        } catch (err) {
            done(err instanceof Error ? err : new Error(String(err)));
        }
    }
}

// Register the node with Node-RED
module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-unpack", UnpackNode);
};
