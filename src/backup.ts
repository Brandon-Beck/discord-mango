/**
 * @param {Guild} [Guild] - The discord server you want to backup
 * @param {object} [options] - The backup options
 */
import fetch from 'node-fetch'
import fs from 'fs'
import readline from 'readline'
import {
  Channel
  ,Client
  ,Collection
  ,Message
  ,MessageAttachment ,MessageEmbed
  ,MessageReaction
  ,MessageStore
  ,ReactionUserStore
  ,Snowflake
  ,TextChannel
  ,User
} from 'discord.js'
import { BackupYield ,BackupYieldType ,DiscordBackupEntry ,RestoreYield } from './types'

const settings = JSON.parse(fs.readFileSync('./settings.json' ,'utf8'))

if (!fs.existsSync(settings.saveDir)) fs.mkdirSync(settings.saveDir)

async function* messageIterator(messageStore: MessageStore ,startAt?: Snowflake): AsyncGenerator<Message> {
  const messages = await messageStore.fetch({ before: startAt })
  if (messages.size > 0) {
    for (const message of messages.values()) {
      yield message
    }
    // console.log(messages.lastKey())
    yield* await messageIterator(messageStore ,messages.lastKey())
  }
}
async function* userIterator(userStore: ReactionUserStore ,startAt?: Snowflake): AsyncGenerator<User> {
  // WARNING!!! Before does not seem to work with last key
  const users = await userStore.fetch({ before: startAt })
  if (users.size > 0) {
    for (const user of users.values()) {
      yield user
    }
    // FIXME: Before does not seem to work with last key! Cannot Loop!
    // console.log(users.lastKey())
    // yield* await userIterator(userStore ,userStore.lastKey())
  }
}

function* attatchmentIterator(attachments: Collection<Snowflake ,MessageAttachment>) {
  for (const at of attachments.values()) {
    yield {
      spoiler: at.spoiler
      ,...at
    }
  }
}

async function* reactionIterator(reacts: Collection<Snowflake ,MessageReaction>) {
  for await (const react of reacts.values()) {
    const users = []
    for await (const user of userIterator(react.users)) {
      users.push(user)
    }
    yield {
      ...react
      ,users
    }
  }
}
async function* embedIterator(embeds: MessageEmbed[]): MessageEmbed[] {
  for (const embed of embeds) {
    yield {
      ...embed
      ,image: {
        url: embed.image.url
        ,width: embed.image.width
        ,height: embed.image.height
        ,proxyURL: embed.image.proxyURL
      }
      ,thumbnail: {
        url: embed.thumbnail.url
        ,width: embed.thumbnail.width
        ,height: embed.thumbnail.height
        ,proxyURL: embed.thumbnail.proxyURL
      }
      ,timestamp: embed.timestamp
      ,footer: {
        text: embed.footer.text
        ,iconURL: embed.footer.iconURL
        ,proxyIconURL: embed.footer.proxyIconURL
      }
      ,provider: {
        name: embed.provider.name
        ,url: embed.provider.url
      }
      ,video: {
        url: embed.video.url
        ,width: embed.video.width
        ,height: embed.video.height
        ,proxyURL: embed.video.proxyURL
      }
      ,author: {
        proxyIconURL: embed.author.proxyIconURL
        ,iconURL: embed.author.iconURL
        ,url: embed.author.url
        ,name: embed.author.name
      }
    }
  }
}


function calcBackupPath(channelId: Snowflake ,timestamp: number) {
  return `${settings.saveDir}/msgStream-${channelId}-${timestamp}.jsonstream`
}

// FIXME: No yield
export async function* startBackup(channel: Channel ,maxMsgs?: number): AsyncGenerator<BackupYield> {
  // Create the backup
  // for (const i of message.channel.fetchMessages()) c++
  if (channel.type !== 'text') {
    throw new Error('Not a Text Channel ')
  }
  const messageStore = (channel as TextChannel).messages
  const stats = {
    messages: {
      seen: 0 ,processed: 0
    }
    ,attatchments: {
      seen: 0 ,processed: 0
    }
    ,embeds: {
      seen: 0 ,processed: 0
    }
    ,reacts: {
      seen: 0 ,processed: 0
    }
  }
  const backupTimeStamp = Date.now()
  const msgPath = calcBackupPath(channel.id ,backupTimeStamp)
  const msgStream = fs.createWriteStream(msgPath)
  yield {
    type: BackupYieldType.Started ,path: msgPath ,channel: channel.id ,timestamp: backupTimeStamp
  }
  for await (const message of messageIterator(messageStore)) {
    const messageObj: DiscordBackupEntry = {
      ...message
      ,attachments: []
      ,reactions: []
      ,embeds: []
      ,channel: undefined
    }
    for await (const at of attatchmentIterator(message.attachments)) {
      stats.attatchments.seen++
      const filePath = `${settings.saveDir}/atStream-${at.id}-${at.name}`
      if (typeof at.attachment === 'string'
        && !fs.existsSync(filePath)) {
        console.log(`Saving Attatchment ${filePath}`)
        const res = await fetch(at.attachment)
        if (res.ok) {
          const atStream = fs.createWriteStream(filePath)
          try {
            await res.body.pipe(atStream)
          }
          catch (e) {
            console.log(`Error occurred while attempting to download ${filePath}`)
            atStream.destroy()
            fs.unlinkSync(atStream.path)
          }
        }
        stats.attatchments.processed++
      }
      else {
        console.log(`Skipping download for attatchment ${filePath}`)
      }
      messageObj.attachments.push(at)
    }
    for await (const reaction of reactionIterator(message.reactions)) {
      stats.reacts.seen++
      stats.reacts.processed++
      messageObj.reactions.push(reaction)
    }
    for await (const embed of embedIterator(message.embeds)) {
      stats.embeds.seen++
      stats.embeds.processed++
      messageObj.embeds.push(embed)
    }

    msgStream.write(`${stats.messages.processed > 0 ? '\n' : ''}${JSON.stringify(messageObj)}`)
    // console.log(JSON.stringify(messageObj,null,2))

    // console.log(message.attachments.toJSON())
    stats.messages.seen++
    stats.messages.processed++
  }
  yield {
    type: BackupYieldType.Finished ,path: msgPath ,channel: channel.id ,timestamp: backupTimeStamp
  }

  console.log(JSON.stringify(stats ,null ,2))
  // channel.send('there are ' + m.size + ' messages')
  // console.log(`there are ${m.size} messages`)
  // console.log(m.toJSON())
}

export async function* restoreBackup(channelId: Snowflake ,backupTimestamp: number): AsyncGenerator<DiscordBackupEntry> {
  const path = calcBackupPath(channelId ,backupTimestamp)
  const fh = await fs.createReadStream(path)
  const rl = readline.createInterface({ input: fh })
  for await (const line of rl) {
    const entry: DiscordBackupEntry = JSON.parse(line)
    yield entry
  }
}
