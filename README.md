#ThriftFiddle#

Maybe you are looking at some binary thrift over the wire, and you want to know what it says?

- Demo: [http://slackhappy.github.io/thriftfiddle/](http://slackhappy.github.io/thriftfiddle/)
- My attempt at understanding the TBinaryProtocol spec [http://slackhappy.github.io/thriftfiddle/tbinaryspec.html](http://slackhappy.github.io/thriftfiddle/tbinaryspec.html)

![Screen shot](https://s3.amazonaws.com/f.cl.ly/items/3m1k0f2C1d0U0y26323u/Screen%20Shot%202015-08-05%20at%204.32.49%20PM.png)

## Supported ##
Everything you can find in a struct.
I64 support from [big.js](https://github.com/MikeMcl/big.js/)

## TODO ##
- TMessage support
- Error recovery
- TCompact support
