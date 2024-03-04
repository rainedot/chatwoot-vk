import {VK} from 'vk-io'
import {
  chatwoot, chatwootAccountId,
  getOrCreateChatwootContact,
  getOrCreateChatwootConversation,
  processChatwootAttachment,
  sendMessage,
} from './chatwoot.js'
import dotenv from 'dotenv';

dotenv.config();

export const vk = new VK({
  token: process.env.VK_ACCESS_TOKEN,
})

/**
 * @param {MessageContext<ContextDefaultState> & {}} ctx
 */
export async function processVkMessage(ctx) {
  const { message } = ctx;

  const externalId = message.from_id
  const contact = await getOrCreateChatwootContact(externalId)
  const conversation = await getOrCreateChatwootConversation(contact);

  const attachments = []
  for (const attachment of message.attachments) {
    const processedAttachment = await processChatwootAttachment(attachment)
    attachments.push(processedAttachment)
  }

  const { data } = await sendMessage(conversation.id, {
    content: message.text,
    message_type: 'incoming',
  }, attachments)

  return data
}

export async function processVkAttachment(attachment, vkUserId) {
  try {
    switch (attachment['file_type']) {
      case 'image':
        return await vk.upload.messagePhoto({
          source: {
            value: attachment['data_url']
          }
        })
      case 'file':
        const splittedPath = attachment.data_url.split('/');
        const filename = splittedPath[splittedPath.length - 1];
        return await vk.upload.messageDocument({
          peer_id: vkUserId,
          source: {
            filename: filename,
            value: attachment['data_url']
          }
        })
      default:
        console.warn(`Skipping attachment with unsupported type: ${attachment['file_type']}`)
        break
    }
  } catch (e) {
    console.error('Error processing attachment', attachment, e);
  }
}

export async function processVkTypingState(userId, state) {
  const contact = await getOrCreateChatwootContact(userId)
  const conversation = await getOrCreateChatwootConversation(contact)
  await chatwoot.conversations(chatwootAccountId).toggleTyping(conversation.id, state ? 'on' : 'off')
}
