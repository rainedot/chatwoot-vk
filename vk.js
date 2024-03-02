import {Keyboard, VK} from 'vk-io'
import {
  chatwoot, chatwootAccountId, findChatwootConversation,
  getOrCreateChatwootContact,
  getOrCreateChatwootConversation, setChatwootConversationStatus,
  processChatwootAttachment,
  sendMessage,
} from './chatwoot.js'
import dotenv from 'dotenv';

dotenv.config();

export const vk = new VK({
  token: process.env.VK_ACCESS_TOKEN,
})

export const createNewTicketMenu = Keyboard.builder()
  .textButton({label: 'Позвать человека', payload: 'create_ticket', color: 'primary'})

export const closeTicketMenu = Keyboard.builder()
  .textButton({ label: 'Проблема была решена', payload: 'problem_solved', color: 'positive' });

/**
 * @param {MessageContext<ContextDefaultState> & {}} ctx
 */
export async function processStart(ctx) {
  await ctx.reply(`
    Hello.
    
    If you have any issue press the "Create a new ticket".
  `)
}

/**
 * @param {MessageContext<ContextDefaultState> & {}} ctx
 */
export async function processVkMessage(ctx) {
  const { message } = ctx;

  const externalId = message.from_id
  const contact = await getOrCreateChatwootContact(externalId)
  const conversation = await getOrCreateChatwootConversation(contact);

  if(ctx.messagePayload === 'create_ticket') {
    await setChatwootConversationStatus(contact, 'open')
    return;
  }

  if(ctx.messagePayload === 'problem_solved') {
    await setChatwootConversationStatus(contact, 'resolved')
    return;
  }

  if (conversation.status !== 'open') {
    await ctx.reply(`Главное меню`, {
      keyboard: createNewTicketMenu,
    });

    return;
  }

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

export async function processVkAttachment(attachment) {
  switch (attachment['file_type']) {
    case 'image':
      return await vk.upload.messagePhoto({
        source: {
          value: attachment['data_url']
        }
      })
    default:
      console.warn(`Skipping attachment with unsupported type: ${attachment['file_type']}`)
      break
  }
}

export async function processVkTypingState(userId, state) {
  const contact = await getOrCreateChatwootContact(userId)
  const conversation = await getOrCreateChatwootConversation(contact)
  await chatwoot.conversations(chatwootAccountId).toggleTyping(conversation.id, state ? 'on' : 'off')
}
