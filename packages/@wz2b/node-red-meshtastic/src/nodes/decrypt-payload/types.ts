import {NodeDef} from 'node-red';

export interface DecryptPayloadOptions {
}

export interface DecryptPayloadNodeDef extends NodeDef, DecryptPayloadOptions {
    encryption: string; // <-- This will be the ID of the config node
}
