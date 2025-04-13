import {NodeMessageInFlow} from "node-red";
import {Message} from "@bufbuild/protobuf";
import {Data} from "../generated/meshtastic/mesh_pb";

// export type ServiceEnvelopePayload = NodeMessageInFlow & any;


/*
 * This helper type removes the `payload` and `$typeName` fields from a protobuf
 * `Data` message. `$typeName` is added by protobuf-es for introspection and is
 * not part of the actual Meshtastic schema. We also remove `payload` so we can
 * override it with a decoded object or plain string in our final application message.
 */
type WithoutTypeNameOrPayload<T> = {
    [K in keyof T as K extends "payload" | "$typeName" ? never : K]: T[K];
};

type DataWithoutTypeNameOrPayload = Partial<WithoutTypeNameOrPayload<Data>>;

/*
 * Represents a fully parsed Meshtastic application-level message in Node-RED.
 *
 * This type flattens the important fields from the `MeshPacket` and inner `Data`
 * protobuf messages into a single object. It also allows the payload to be
 * replaced with the decoded application message (as a protobuf `Message`)
 * or a plain string, depending on content type.
 *
 * `contentType` indicates the decoded payload's type (like a content-type header).
 */
export type MeshtasticApplicationMessage =
    NodeMessageInFlow
    & DataWithoutTypeNameOrPayload
    & {
    channel: number;
    rxRssi: number;
    rxSnr: number;
    id: number;
    hopStart: number;
    hopLimit: number;
    contentType: string | Message["$typeName"];
    channelId: string | undefined; // Make it optional to allow for missing channelName
    gatewayId: string | undefined; // Make it optional to allow for missing gatewayId
    payload: string | Message;
};
