import * as crypto from 'crypto';
import {MeshPacket} from "./generated/meshtastic/mesh_pb";

/**
 * Decrypts a Meshtastic payload using AES-256-CTR mode.
 *
 * @param encryptedData Buffer containing the encrypted data (not base64)
 * @param key 32-byte encryption key (Buffer)
 * @param from Source node ID (number)
 * @param id Packet ID (number)
 * @returns Decrypted Buffer
 */
export function decryptMeshtastic(packet: MeshPacket, key: Buffer): Buffer {
    // Construct 16-byte nonce: 8 bytes ID, 8 bytes FROM — both little-endian


    const nonce = Buffer.alloc(16);

    // The nonce process is a little confusing.  The packet ID and from are actually
    // both 32 bits, but they are packed into 64 bits.  Because it's L.E. this
    // means that viewed as 32-bits each you would see:
    //  [ 32-bit id ] [ 0x00 0x00 0x00 0x00 ] [ 32-bit from ] [ 0x00 0x00 0x00 0x00 ]
    // If there were an 'extra nonce' it would fill in the zeros right after the ID (in
    // the middle).
    nonce.writeBigUInt64LE(BigInt(packet.id), 0);
    nonce.writeBigUInt64LE(BigInt(packet.from), 8);



    console.log("Nonce:", nonce.toString("hex"));
    console.log("  key:", key.toString("hex"));


    let algorithm;
    if (key.length === 16) {
        algorithm = "aes-128-ctr";
    } else if (key.length === 32) {
        algorithm = "aes-256-ctr";
    } else {
        throw new Error("Invalid key length. Key must be 16 bytes for AES-128 or 32 bytes for AES-256.");
    }


    if (packet.payloadVariant.case === "encrypted") {
        const encryptedData = packet.payloadVariant.value;
        const decipher = crypto.createDecipheriv(algorithm, key, nonce);

        const decrypted = Buffer.concat([
            decipher.update(Buffer.from(encryptedData)),
            decipher.final()
        ]);

        return decrypted;
    } else {
        throw new Error("Packet does not contain encrypted data.");
    }
}
