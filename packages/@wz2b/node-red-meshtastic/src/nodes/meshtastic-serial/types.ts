import {NodeDef} from 'node-red';



export interface MestasticSerialInOptions {
    serialConfig: string; // This is the ID of the config node
}
export interface MestasticSerialInNodeDef extends NodeDef, MestasticSerialInOptions {}


export interface MestasticSerialPortOptions {
    port: string; // or whatever field you need
    baudRate: number;
}

export interface MestasticSerialPortNodeDef extends NodeDef, MestasticSerialPortOptions {}
