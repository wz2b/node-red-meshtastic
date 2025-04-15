import {NodeDef} from 'node-red';


export interface KeySet {
    channel: number;
    psk: string; // base64 string

}
export interface MestasticEncryptionOptions {
    keys: KeySet[];
}

export interface MestasticEncryptionOptionsNodeDef extends NodeDef, MestasticEncryptionOptions {}

