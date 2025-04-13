import {NodeDef} from 'node-red';

export interface MestasticEncryptionOptions {
    keys: {
        channel: number;
        psk: string; // base64 string
    }[];
}
export interface MestasticEncryptionOptionsNodeDef extends NodeDef, MestasticEncryptionOptions {}

