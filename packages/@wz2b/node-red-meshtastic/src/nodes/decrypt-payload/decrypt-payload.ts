import {NRTSNode} from "../../common/NRTSNode";
import {DecryptPayloadNodeDef} from "./types";
import {NodeAPI, NodeMessage, NodeMessageInFlow} from "node-red";
import {decryptMeshtastic} from "../../common/decrypt";
import {fromBinary} from "@bufbuild/protobuf";
import {FromRadio, MeshPacket, DataSchema} from "../../generated/meshtastic/mesh_pb";
import {Node as NodeRedNode} from 'node-red';

export const DEFAULT_PUBLIC_KEY = "1PG7OiApB1nwvP+rz05pAQ==";

class DecryptPayloadNode extends NRTSNode<DecryptPayloadNodeDef> {
    private not_encrypted = 0;
    private good = 0;
    private total = 0;

    constructor(RED: NodeAPI, node: NodeRedNode, config: DecryptPayloadNodeDef) {
        super(RED, node, config);
    }

    protected override onInput(
        msg: NodeMessageInFlow,
        send: (msgs: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
        done: (err?: Error) => void
    ) {
        this.total++;
        const fromRadio = msg.payload as FromRadio;
        const packet = fromRadio?.payloadVariant?.case === "packet"
            ? fromRadio.payloadVariant.value as MeshPacket
            : null;

        if (!packet || packet.payloadVariant.case === "decoded") {
            send([msg, null]); // Already decoded, send on primary
            this.not_encrypted = this.not_encrypted + 1;
            this.updateCountStatus();
            return done();
        }

        if (packet.payloadVariant.case !== "encrypted") {
            this.updateCountStatus();
            return done(); // Not decryptable
        }

        const encrypted = packet.payloadVariant.value as Uint8Array;
        const data = Buffer.from(encrypted);
        const key = Buffer.from(DEFAULT_PUBLIC_KEY, "base64");

        try {
            const decryptedBuffer = decryptMeshtastic(packet.from, packet.id, data, key);
            const decoded = fromBinary(DataSchema, decryptedBuffer);

            const newFromRadio: FromRadio = {
                ...fromRadio,
                payloadVariant: {
                    case: "packet",
                    value: {
                        ...packet,
                        payloadVariant: {
                            case: "decoded",
                            value: decoded
                        }
                    }
                }
            };

            send([[{...msg, payload: newFromRadio}], []]); // Success path
            this.good = this.good + 1;
            this.updateCountStatus();
        } catch (err: any) {
            const errMsg = {
                ...msg, topic: "decryption error", error: err.message || String(err)
            }

            send([[], [errMsg]]);
        }
        this.updateCountStatus();
        return done();
    }

    private updateCountStatus() {
        const bad = this.total = this.good - this.not_encrypted;
        this.status(`D:${this.good} F:${bad} U:${this.not_encrypted} T:${this.total}`);    }
}

// Register the node with Node-RED
module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-decrypt-payload", DecryptPayloadNode);
};
