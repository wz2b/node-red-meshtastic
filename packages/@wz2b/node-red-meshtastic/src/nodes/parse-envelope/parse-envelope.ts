import {NRTSNode} from "../../common/NRTSNode";
import {ParseEnvelopeNodeDef} from "./types";
import {NodeAPI, NodeMessage, NodeMessageInFlow} from "node-red";
import {create, fromBinary} from "@bufbuild/protobuf";
import {ServiceEnvelope, ServiceEnvelopeSchema} from "../../generated/meshtastic/mqtt_pb";
import {FromRadio, FromRadioSchema} from "../../generated/meshtastic/mesh_pb";
import {Node as NodeRedNode} from 'node-red';

export interface EnvelopeMetaMessage extends NodeMessageInFlow {
    serviceEnvelope: {
        gatewayId?: string;
        channelId?: string;
    }
}


class ParseEnvelopeNode extends NRTSNode<ParseEnvelopeNodeDef> {
    constructor(RED: NodeAPI, node: NodeRedNode, config: ParseEnvelopeNodeDef) {
        super(RED, node, config);
    }

    protected override onInput(
        msg: NodeMessageInFlow,
        send: (msgs: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
        done: (err?: Error) => void
    ) {
        try {
            if (!msg.payload || !Buffer.isBuffer(msg.payload)) {
                return done(new Error("Expected payload to be a Buffer"));
            }

            const envelope = fromBinary(ServiceEnvelopeSchema, msg.payload);

            if (envelope.channelId === "8") {
                envelope.channelId = "0";
            }

            if (!envelope.packet) {
                return done(new Error("Envelope packet is missing"));
            }

            // Convert ServiceEnvelope into a FromRadio-style structure
            const fromRadio = create(FromRadioSchema, {
                payloadVariant: {
                    case: "packet",
                    value: envelope.packet,
                }
            });

            send({
                _msgid: msg._msgid,
                topic: "FromRadio",
                payload: fromRadio,
                serviceEnvelope: {
                    gatewayId: envelope.gatewayId,
                    channelId: envelope.channelId
                }
            } as EnvelopeMetaMessage);

            done();
        } catch (err) {
            done(err instanceof Error ? err : new Error(String(err)));
        }
    }
}

module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-parse-envelope", ParseEnvelopeNode);
};
