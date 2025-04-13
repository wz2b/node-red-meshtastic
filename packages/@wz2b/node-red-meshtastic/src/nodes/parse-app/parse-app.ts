import {NRTSNode} from "../../common/NRTSNode";
import {ParseAppNodeDef} from "./types";
import {Node as NodeRedNode, NodeAPI, NodeMessage, NodeMessageInFlow} from "node-red";

import {fromBinary, JsonValue, Message} from "@bufbuild/protobuf";
import {MeshtasticApplicationMessage} from "../../common/messages";
import {GenMessage} from "@bufbuild/protobuf/codegenv1";
import {
    Data, FromRadio,
    MeshPacket,
    NeighborInfoSchema,
    PositionSchema,
    RouteDiscoverySchema,
    RoutingSchema,
    UserSchema,
    WaypointSchema
} from "../../generated/meshtastic/mesh_pb";
import {PortNum} from "../../generated/meshtastic/portnums_pb";
import {MapReportSchema} from "../../generated/meshtastic/mqtt_pb";
import {HardwareMessageSchema} from "../../generated/meshtastic/remote_hardware_pb";
import {AdminMessageSchema} from "../../generated/meshtastic/admin_pb";
import {ModuleConfig_AudioConfigSchema} from "../../generated/meshtastic/module_config_pb";
import {PaxcountSchema} from "../../generated/meshtastic/paxcount_pb";
import {StoreAndForwardSchema} from "../../generated/meshtastic/storeforward_pb";
import {TelemetrySchema} from "../../generated/meshtastic/telemetry_pb";
import {EnvelopeMetaMessage} from "../parse-envelope/parse-envelope";


type AnyMessageSchema = GenMessage<Message, JsonValue>;


interface GatewayPayloadMessage {
    gatewayId?: string;
    channelName?: string;
    // Add other properties as needed
}

export const messageMap: Record<number, AnyMessageSchema> = {
    [PortNum.POSITION_APP]: PositionSchema,
    [PortNum.NODEINFO_APP]: UserSchema, // not NodeInfoSchema,
    [PortNum.ROUTING_APP]: RoutingSchema,
    [PortNum.MAP_REPORT_APP]: MapReportSchema,
    [PortNum.REMOTE_HARDWARE_APP]: HardwareMessageSchema,
    [PortNum.ADMIN_APP]: AdminMessageSchema,
    [PortNum.WAYPOINT_APP]: WaypointSchema,
    [PortNum.AUDIO_APP]: ModuleConfig_AudioConfigSchema,  // ?????
    [PortNum.PAXCOUNTER_APP]: PaxcountSchema,
    [PortNum.STORE_FORWARD_APP]: StoreAndForwardSchema,
    [PortNum.TELEMETRY_APP]: TelemetrySchema,
    [PortNum.TRACEROUTE_APP]: RouteDiscoverySchema,  // ?????
    [PortNum.NEIGHBORINFO_APP]: NeighborInfoSchema
};


class ParseAppNode extends NRTSNode<ParseAppNodeDef> {
    constructor(RED: NodeAPI, node: NodeRedNode, config: ParseAppNodeDef) {
        super(RED, node, config);

    }

    protected override onInput(
        msg: NodeMessageInFlow,
        send: (msgs: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
        done: (err?: Error) => void
    ) {
        try {
            const fromRadio = msg.payload as FromRadio;
            if (!fromRadio || fromRadio.payloadVariant.case !== "packet") {
                console.log("parse-app: no packet or wrong variant");
                return done();
            }

            const packet = fromRadio.payloadVariant.value as MeshPacket;
            if (!packet || packet.payloadVariant.case !== "decoded") {
                throw new Error("Can't parse packet without decoded data");
            }

            const data = packet.payloadVariant.value as Data;

            //
            // If the message came through an MQTT channel, then the
            // outer envelope may have a gateway id and channel name
            // attached to them.  If the message came from a straem
            // based channel (serial, tcp, or udp) it will not have
            // either of these fields, so gateawyId will be undefined,
            // and we will just use the channel number as the channel name
            //
            let gatewayId: string | undefined;
            let channelId: string;

            if (this.isEnvelopeMetaMessage(msg)) {
                gatewayId = msg.serviceEnvelope?.gatewayId;
                channelId = msg.serviceEnvelope?.channelId ?? (packet.channel === 8 ? "0" : packet.channel.toString());
            } else {
                channelId = packet.channel === 8 ? "0" : packet.channel.toString();
            }

            console.log("Attempting to decode portnum", data.portnum);
            const handler = messageMap[data.portnum];

            if (handler && data.payload) {
                const parsed = fromBinary(handler, data.payload);
                const {$typeName: _ignore, ...parsedWithoutTypeName} = parsed;

                const app_message: MeshtasticApplicationMessage = {
                    _msgid: msg._msgid,
                    source: data.source || packet.from,
                    dest: data.dest || packet.to,
                    channel: packet.channel == 8 ? 0 : packet.channel,
                    rxRssi: packet.rxRssi,
                    rxSnr: packet.rxSnr,
                    id: packet.id,
                    hopStart: packet.hopStart,
                    hopLimit: packet.hopLimit,
                    portnum: data.portnum,
                    gatewayId: gatewayId,
                    channelId: channelId, // fallback to packet's channelName if not set
                    contentType: parsed.$typeName, // promote the inner payload type
                    payload: parsedWithoutTypeName as Message // strip out $typeName from payload
                };
                console.log("Decoded application message:", JSON.stringify(parsed, null, 2));
                send(app_message);

            } else if ([PortNum.TEXT_MESSAGE_APP, PortNum.REPLY_APP].includes(data.portnum)) {
                const app_message: MeshtasticApplicationMessage = {
                    _msgid: msg._msgid,
                    source: data.source || packet.from,
                    dest: data.dest || packet.to,
                    channel: packet.channel == 8 ? 0 : packet.channel,
                    rxRssi: packet.rxRssi,
                    rxSnr: packet.rxSnr,
                    id: packet.id,
                    hopStart: packet.hopStart,
                    hopLimit: packet.hopLimit,
                    portnum: data.portnum,
                    channelId: channelId, // fallback to packet's channelName if not set
                    gatewayId: gatewayId,
                    contentType: "text/plain", // promote the inner payload type
                    payload: data.toString()
                }
                console.log("Parsed text message:", app_message.payload)
                send(app_message);
            } else {
                console.log("Unsupported port number", data.portnum);
                done(Error("Unsupported port number")); // or log a warning about unsupported portnum
            }

            done();
        } catch (err) {
            console.log("Exception in ParseAppNode:", err);
            done(err instanceof Error ? err : new Error(String(err)));
        }
    }

    isEnvelopeMetaMessage(msg: NodeMessageInFlow): msg is EnvelopeMetaMessage {
        return (
            typeof msg === "object" &&
            "serviceEnvelope" in msg &&
            typeof (msg as any).serviceEnvelope === "object"
        );
    }
}

// Register the node with Node-RED
module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-parse-app", ParseAppNode);
};
