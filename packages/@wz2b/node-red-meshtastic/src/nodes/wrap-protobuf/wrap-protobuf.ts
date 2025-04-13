import {NRTSNode} from "../../common/NRTSNode";
import {WrapProtobufNodeDef} from "./types";
import {NodeAPI, NodeMessage, NodeMessageInFlow} from "node-red";
import {Node as NodeRedNode, NodeDef} from 'node-red';

class WrapProtobufNode extends NRTSNode<WrapProtobufNodeDef> {
    constructor(RED: NodeAPI, node: NodeRedNode, config: WrapProtobufNodeDef) {
        super(RED, node, config);
    }

    protected override onInput(
        msg: NodeMessageInFlow,
        send: (msgs: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
        done: (err?: Error) => void
    ) {
        try {
            done();
        } catch (err: any) {
            done(err);
        }
    }
}

// Register the node with Node-RED
module.exports = (API: NodeAPI) => {
    NRTSNode.registerType(API, "meshtastic-wrap-protobuf", WrapProtobufNode);
};
