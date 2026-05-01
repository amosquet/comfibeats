# comfibeats

Hello! I got tired of the bot that we were using, that I chose to use, that kept crashing and I didn't want to figure out how it worked, so I made my own.
Feel free to use this to run your own bot, it works if your system has good resources, idk how to make it more efficient yet. I'll work on it.


To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.js
```

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.


Little note to self. I want to make some easy deployment script for self-hosting. I kinda want to use Alpine Linux, just because. (actually might not need this, lol)
Make sure to set ``DISCORD_AUTH`` and ``CLIENT_ID`` in ``.env``, and ``guildId`` in ``config.json``
