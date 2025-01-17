import {processChatwootMessage} from './chatwoot.js'
import {processVkMessage, processVkTypingState, vk} from './vk.js'
import express from 'express'
import dotenv from 'dotenv';

dotenv.config();

const bindPort = process.env.APP_PORT;

vk.updates.on('message_new', context => {
  if (!context.isUser || !context.isFromUser) return


  processVkMessage(context).then().catch(console.error)
})

vk.updates.on('message_typing_state', context => {
  if (!context.isUser) return
  processVkTypingState(context.fromId, context.isTyping).then().catch(console.error)
})

async function handleChatwootWebhook() {
  const app = express()
  app.use(express.json())

  app.post('/', (req, res) => {
    try {
      if (req.body.event === 'message_created' && req.body.message_type === 'outgoing') {
        processChatwootMessage(req.body)
      }
    } catch (e) {
      console.log(e);
      res.sendStatus(500);
      return;
    }

    res.sendStatus(200)
  })

  await app.listen(bindPort, () => {
    console.log(`express started, port: ${bindPort}`)
  });
}

vk.updates.start()
  .then(() => {
    console.log('polling started')
  })
  .catch(() => {
    console.log('vk updates tried to crash')
  })
handleChatwootWebhook()

