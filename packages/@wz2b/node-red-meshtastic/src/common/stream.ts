import {toBinary} from "@bufbuild/protobuf";
import {ToRadio, ToRadioSchema} from "../generated/meshtastic/mesh_pb";

enum ParseState {
    WAIT_FOR_START1,
    WAIT_FOR_START2,
    WAIT_FOR_LEN1,
    WAIT_FOR_LEN2,
    READ_PAYLOAD
}



export class StreamFSM {
    private state = ParseState.WAIT_FOR_START1;
    private lastState = ParseState.WAIT_FOR_START1;
    private expectedLength = 0;
    private payloadBuffer: Buffer | null = null;
    private payloadOffset = 0;

    feed(chunk: Buffer): Buffer | undefined {
        for (const byte of chunk) {

            // if(this.state != this.lastState) {
            //     console.log("-> ", this.state);
            //     this.lastState = this.state;
            // }
            // console.log(this.state);
            // if (this.state === ParseState.WAIT_FOR_START1 && byte !== 0x94) {
            //     const isAscii = byte >= 32 && byte <= 126;
            //     const printable = isAscii ? `'${String.fromCharCode(byte)}'` : `0x${byte.toString(16).padStart(2, "0")}`;
            //     console.log(`Unexpected byte while waiting for START1: ${printable}`);
            // }

            switch (this.state) {
                case ParseState.WAIT_FOR_START1:
                    if (byte === 0x94) {
                        this.state = ParseState.WAIT_FOR_START2;
                    }
                    break;

                case ParseState.WAIT_FOR_START2:
                    if (byte === 0xC3) {
                        this.state = ParseState.WAIT_FOR_LEN1;
                    } else {
                        this.state = ParseState.WAIT_FOR_START1; // restart
                    }
                    break;

                case ParseState.WAIT_FOR_LEN1:
                    this.expectedLength = byte;
                    this.state = ParseState.WAIT_FOR_LEN2;
                    break;

                case ParseState.WAIT_FOR_LEN2:
                    this.expectedLength = (this.expectedLength << 8) | byte;

                    if (this.expectedLength > 1024) {
                        console.warn(`Invalid length: ${this.expectedLength}`);
                        this.reset();
                    } else {
                        this.payloadBuffer = Buffer.alloc(this.expectedLength);  // 🧠 initialize buffer
                        this.payloadOffset = 0;                                  // 🧠 reset offset
                        this.state = ParseState.READ_PAYLOAD;
                    }
                    break;

                case ParseState.READ_PAYLOAD:
                    if (this.payloadBuffer && this.payloadOffset < this.expectedLength) {
                        this.payloadBuffer[this.payloadOffset++] = byte;

                        if (this.payloadOffset === this.expectedLength) {
                            const complete = this.payloadBuffer;
                            this.reset();
                            return complete;
                        }
                    }

                    break;
            }
        }

        return undefined;
    }

    reset() {
        this.state = ParseState.WAIT_FOR_START1;
        this.expectedLength = 0;
        this.payloadBuffer = null;
        this.payloadOffset = 0;
    }


    static encapsulate(message: ToRadio): Buffer<ArrayBuffer> {
        const binary = toBinary(ToRadioSchema, message)


        // 2. Frame it with 0xC0 + 2-byte length
        const length = binary.length;

        const header = Buffer.from([
            0x94, // START1
            0xC3, // START2
            (length >> 8) & 0xff,
            length & 0xff,
        ]);

        // 3. Final packet = header + protobuf payload
        const framed = Buffer.concat([header, binary]);

        return framed
    }
}
