import {NodeDef} from 'node-red';


export enum PacketTypes {
    ToRadio = "ToRadio",
    ServiceEnvelope = "ServiceEnvelope",
}

export interface WrapProtobufOpts {
    packetType: PacketTypes;

}

export interface WrapProtobufNodeDef extends NodeDef, WrapProtobufOpts {}
