import ChatwootClient from '@chatwoot/node'
import {processVkAttachment, vk} from './vk.js'
import axios from 'axios'
import FormData from 'form-data'
import dotenv from 'dotenv';

dotenv.config();

export const chatwootAccountId = Number(process.env.CHATWOOT_ACCOUNT_ID)
export const chatwootInboxId = Number(process.env.CHATWOOT_INBOX_ID)

export const chatwoot = new ChatwootClient({
  config: {
    host: process.env.CHATWOOT_HOST,
    apiAccessToken: process.env.CHATWOOT_ACCESS_TOKEN,
  },
})

export async function getOrCreateChatwootContact(userId) {
  const contact = await findChatwootContact(userId)
  if (!contact) return await createChatwootContact(userId)
  return contact
}

async function findChatwootContact(externalId) {
  const { data } = await chatwoot.contacts(chatwootAccountId).search(externalId)

  if (!data.payload || data.payload.length === 0) return null
  return data.payload.filter(contact => typeof getChatwootContactInbox(contact) !== 'undefined')
    .sort((a, b) => b.id - a.id)[0]
}

function getChatwootContactInbox(contact) {
  return contact['contact_inboxes'].find(contactInbox => contactInbox['inbox'].id === chatwootInboxId)
}

async function createChatwootContact(externalId) {
  const [user] = await vk.api.users.get({
    user_ids: [externalId],
    fields: ['photo_100', 'screen_name']
  })

  const { data } = await chatwoot.contacts(chatwootAccountId).create({
    inbox_id: chatwootInboxId,
    name: `${user.first_name} ${user.last_name}`,
    avatar_url: user.photo_100,
    identifier: externalId,
  })

  return data.payload['contact']
}

export async function getOrCreateChatwootConversation(contact) {
  const conversation = await findChatwootConversation(contact)
  if (!conversation) return await createChatwootConversation(contact)
  return conversation
}

export async function findChatwootConversation(contact) {
  const { data } = await chatwoot.contacts(chatwootAccountId).getConversationsByContactId(contact.id)
  if (!data.payload || data.payload.length === 0) return null
  return data.payload.filter(conversation => conversation['inbox_id'] === chatwootInboxId)
    .sort((a, b) => b.id - a.id)[0]
}

/**
 *
 * @param conversation {any}
 * @param status {'resolved' | 'open' | 'pending'}
 * @return {Promise<*>}
 */
export async function setChatwootConversationStatus(conversation, status) {
  return chatwoot.conversations(chatwootAccountId).toggleStatus(conversation.id, status);
}

export async function createChatwootConversation(contact) {
  const inbox = getChatwootContactInbox(contact)
  const { data } = await chatwoot.conversations(chatwootAccountId).create({
    source_id: inbox.source_id,
  })
  return data
}

export async function processChatwootMessage(data) {
  if (!data.content && data.attachments.length === 0) {
    console.log(`Invalid content for message without attachments: ${data.content}`)
    return
  }
  if(data.private) {
    return;
  }

  const conversation = data['conversation']

  const contactInbox = conversation['contact_inbox']
  const { data: contactResponse } = await chatwoot.contacts(chatwootAccountId).show(contactInbox.contact_id)


  if (!contactResponse.payload) {
    throw new Error(`Unable to fetch contact for conversation ${conversation.id}`)
  }

  const { payload: contact } = contactResponse

  const attachments = []
  if (data.attachments) {
    for (const attachment of data.attachments) {
      const cwFile = await processVkAttachment(attachment, contact.identifier)

      if(!cwFile) {
        continue;
      }
      attachments.push(cwFile)
    }
  }

  if(!data.content && attachments.length === 0) {
    return;
    //throw new Error('no content and no attachment')
  }

  await vk.api.messages.send({
    user_id: contact.identifier,
    message: data.content ?? '',
    attachment: attachments.length === 0 ? undefined : attachments.map(a => a.toString()).join(','),
    random_id: (new Date()).getTime(),
  });
}

export async function sendMessage(conversationId, params, files = []) {
  if (!files) return await chatwoot.conversations(chatwootAccountId).sendMessage(conversationId, params)
  chatwoot.conversations(chatwootAccountId)
  const form = new FormData()
  form.append('content', params.content ?? '')
  form.append('message_type', params.message_type)
  files.forEach(file => form.append('attachments[]', file))

  // noinspection JSCheckFunctionSignatures
  return await chatwoot.client.post(
    `${chatwoot.conversations(chatwootAccountId).path}/${conversationId}/messages`, form,
    { headers: { ...form.getHeaders() } }
  )
}

export async function processChatwootAttachment(attachment) {
  let sizes;
  let response;
  switch (attachment.type) {
    case 'photo':
      const photo = attachment.photo
      sizes = photo.sizes.sort((a, b) => (b.width + b.height) - (a.width + a.height))
      response = await axios.get(sizes[0].url, {
        responseType: 'stream'
      })
      return response.data
    case 'doc':
      const doc = attachment.doc
      response = await axios.get(doc.url, {
        responseType: 'stream'
      })
      return response.data
    default:
      console.warn(`Skipping attachment with unsupported type: ${attachment.type}`)
      break
  }
}
