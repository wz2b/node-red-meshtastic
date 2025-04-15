import {NRTSNode} from "../../common/NRTSNode";
import {Node as NodeRedNode, NodeAPI} from "node-red";
import {MestasticEncryptionOptionsNodeDef} from "./types";

export class MeshtasticEncryptionOptionsNode extends NRTSNode<MestasticEncryptionOptionsNodeDef> {
    constructor(RED: NodeAPI, node: NodeRedNode, config: MestasticEncryptionOptionsNodeDef) {
        super(RED, node, config);

        if (!config.keys || !Array.isArray(config.keys)) {
            this.config.keys = [
                { channel: 0, psk: "AQ==" }
            ];
        }
    }

    getPskForChannel(channel: number): string | undefined {
        return this.config.keys.find(k => k.channel === channel)?.psk;
    }
}



module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-encryption-config", MeshtasticEncryptionOptionsNode);
};

