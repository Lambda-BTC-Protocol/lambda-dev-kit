# Lambda Dev Kit

## Getting started

This dev kit is `bun` only as we are using bun specific stuff, so make sure you have Bun installed.

First install all the dependencies
``` bash
bun install
```

There are two ways you can use to develop smart contracts, run them normally and compare logs.
``` bash
bun run dev
```

or write actual tests and make sure they behave as you would expect.
``` bash
bun run test
```

## Develop smart contracts

there is only a few files you need to know to get started.
### src/contracts/*

Here are the smart contracts, you can use them as inspiration. Add your new contract to this directory as well

### src/util/run.ts

Here are utilities to run inscriptions, query stuff or advance to the next block

### src/develop.ts

Here you should add stuff that gets executed when you run `bun run dev`.
It is prefilled with a bitcoin mint and transfer.

### src/test

Here you can add tests to make sure your contract behaves as expected


# FAQ

### Protocol Fees?

The dev-kit is a smaller version of the full client. There are no protocol fees in this dev kit


