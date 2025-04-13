# Meshtastic Node Red Building Blocks

## Description

This package provides some Node-Red libraries for working with Meshtastic devices.  I built it
mainly for experimenters as a way to get at some of the lower-level constructs like encryption
and decryption, packet envelopes for various transports, and to parse and generate standard
protobuf messages without having to deal with protobufs directly.  It also gives you
an easy way to xperiment with standard protobufs.

TypeScript-compatible protobuf message definitions for Meshtastic devices, compiled from the
official .proto files. It allows decoding and working with encrypted and map traffic in environments like Node-RED, MQTT
pipelines, or standalone TypeScript applications.


## License

This project is licensed under the GNU General Public License v3.0 (GPLv3).  
See the [LICENSE](./LICENSE) file for details.

### Included Meshtastic Protobuf Definitions

This project generates typescript objects to represent the protobufs defined by
[Meshtastic project](https://github.com/meshtastic/protobufs), which are also licensed under GPLv3.


### Build Process

To build this from source you have to generate the protobuf typescript objects
first. This is a separate step so as to not slow down experimentation and
development.  Clone, then:

* npm run generate
* npm run build

