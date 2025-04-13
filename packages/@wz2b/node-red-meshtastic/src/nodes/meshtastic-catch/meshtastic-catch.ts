import {NRTSNode} from "../../common/NRTSNode";
import {Node as NodeRedNode, NodeAPI} from "node-red";
import {MestasticCatchNodeDef} from "./types";

export class MeshtasticCatchNode extends NRTSNode<MestasticCatchNodeDef> {

    constructor(RED: NodeAPI, node: NodeRedNode, config: MestasticCatchNodeDef) {
        super(RED, node, config);
    }
}

module.exports = (RED: NodeAPI) => {
    NRTSNode.registerType(RED, "meshtastic-catch", MeshtasticCatchNode);
};