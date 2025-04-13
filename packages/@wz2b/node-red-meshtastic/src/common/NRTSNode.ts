import {Node as NodeRedNode, NodeAPI, NodeDef, NodeMessage, NodeMessageInFlow, NodeStatus,} from "node-red";
import {MeshtasticCatchNode} from "../nodes/meshtastic-catch/meshtastic-catch";

export abstract class NRTSNode<TConfig extends NodeDef = NodeDef> {
    private static typedInstances = new Map<NodeRedNode, NRTSNode>();

    protected constructor(
        private RED: NodeAPI,
        private node: NodeRedNode,
        protected config: TConfig
    ) {
        RED.nodes.createNode(node, config);
        NRTSNode.typedInstances.set(node, this);

        this.node.on("input",
            (msg, send, done) => this.onInput(msg, send, done));
        this.node.on("close", (r: boolean, d: () => void) => this.onClose(r, d));
    }

    /* Default onInput - subclasses should override this if they want inputs */
    protected onInput(
        msg: NodeMessageInFlow,
        send: (msg: NodeMessage | Array<NodeMessage | NodeMessage[] | null>) => void,
        done: (err?: Error) => void
    ): void {
        console.log("default input triggered")
        done();
    }

    /* Default onClose - subclasses should override this if they want close notifications */
    protected onClose(removed: boolean, done: () => void): void {
        NRTSNode.typedInstances.delete(this.node); // cleanup
        done();
    }

    /*
     * Since we don't inherit from Node (NodeRedNode) give us access to
     * the send, error, and status messages in case any of our subclasses
     * want to call those.
     */
    protected send(msg?: NodeMessage | NodeMessage[]): void {
        this.node.send(msg);
    }

    protected sendMany(outputs: (NodeMessage | NodeMessage[] | null)[]): void {
        this.node.send(outputs);
    }


    protected error(err: any): void {
        const messageText = typeof err === 'string' ? err : err?.message || 'Unknown error';

        // Send to Node-RED log
        this.node.error(messageText);

        const msg: NodeMessage & { error: any } = {
            error: {
                message: messageText,
                source: {
                    id: this.node.id,
                    type: this.node.type,
                    name: this.node.name,
                    count: 1
                }
            },
            _msgid: this.RED.util.generateId(),
            topic: `[${this.node.type}] ${this.node.name || this.node.id}`,
            payload: messageText // Useful for debug nodes
        };

        for (const instance of NRTSNode.typedInstances.values()) {
            if (typeof instance.send === "function" && instance.node?.type === "meshtastic-catch") {
                instance.send(msg);
            }
        }
    }


    protected status(status: string | NodeStatus): void {
        this.node.status(status);
    }

    public get id(): string {
        return this.node.id;
    }


    protected getNodesByType<T extends NodeRedNode = NodeRedNode>(type: string): T[] {
        const matches: T[] = [];

        this.RED.nodes.eachNode((def) => {
            if (def.type === type) {
                const node = this.RED.nodes.getNode(def.id);
                if (node) matches.push(node as T);
            }
        });

        return matches;
    }

    protected getNodeTyped<T extends NRTSNode>(id: string): T | undefined {
        const raw = this.RED.nodes.getNode(id);
        return NRTSNode.typedInstances.get(raw) as T | undefined;
    }

    protected getNodeTypedSafe<T extends NRTSNode>(
        id: string,
        ctor: new (...args: any[]) => T
    ): T | undefined {
        const raw = this.RED.nodes.getNode(id);
        const typed = NRTSNode.typedInstances.get(raw);
        return typed instanceof ctor ? typed as T : undefined;
    }


    static registerType<T extends NRTSNode, TConfig extends NodeDef = NodeDef>(
        RED: NodeAPI,
        type: string,
        constructor: new (RED: NodeAPI, node: NodeRedNode, config: TConfig) => T,
        opts?: any
    ): void {
        RED.log.info("Registering TypeScript node: " + type);

        RED.nodes.registerType(
            type,
            function (this: NodeRedNode, config: NodeDef) {
                new constructor(RED, this, config as TConfig);
            },
            opts
        );
    }
}
