import { Client ,MessageAdditions ,MessageAttachment ,MessageEmbed ,MessageOptions ,Snowflake } from 'discord.js'
import fs from 'fs'
import { restoreBackup ,startBackup } from './backup'
import { BackupYieldType } from './types'

const client = new Client()
const settings = JSON.parse(fs.readFileSync('./settings.json' ,'utf8'))

client.on('ready' ,() => {
  console.log("I'm ready !")
})

async function sleepFor(n: number) {
  return new Promise((r) => setTimeout(r ,n))
}

client.on('message' ,async (message) => {
  // This reads the first part of your message behind your prefix to see which command you want to use.
  const command = message.content.toLowerCase().slice(settings.prefix.length).split(' ')[0]

  // These are the arguments behind the commands.
  const args: string[] = message.content.split(' ').slice(1)!

  // If the message does not start with your prefix return.
  // If the user that types a message is a bot account return.
  // If the command comes from DM return.
  if (!message.content.startsWith(settings.prefix) || message.author.bot || !message.guild) return

  if (command === 'backup') {
    // Check member permissions
    if (!message.member.hasPermission('ADMINISTRATOR')) {
      return message.channel.send('I refuse to serve you!')
    }
    if (args.length < 1) return message.channel.send(`Usage: ${settings.prefix}backup (<ChannelId>|'this') [<maxNewMessages>] - Backs up channel id. if maxNewMessages is provided, we will stop processing once we backup that amount`)
    if (args[0].toLowerCase() === 'this') args[0] = message.channel.id
    const channel = await client.channels.fetch(args[0])
    const max = args[1] !== undefined ? parseInt(args[1]) : undefined
    for await (const evnt of startBackup(channel ,max)) {
      if (evnt.type === BackupYieldType.Started) {
        await message.channel.send(`Backing up <${evnt.channel}> to <${evnt.channel}-${evnt.timestamp}>`)
      }
      if (evnt.type === BackupYieldType.Finished) {
        await message.channel.send(`Backup <${evnt.channel}-${evnt.timestamp}> Finished!`)
      }
    }
  }
  if (command === 'restore') {
    // Check member permissions
    if (!message.member.hasPermission('ADMINISTRATOR')) {
      return message.channel.send('I refuse to serve you!')
    }
    const usageMsg = `Usage: ${settings.prefix}restore <channelId> <backupTimestamp> [<maxNewMessages>] - Restores messages from backup in a horrible fashion. if maxNewMessages is provided, we will stop processing once we restore that amount`
    if (args.length < 1) return message.channel.send(usageMsg)

    // if (args[0].toLowerCase() === 'this') args[0] = message.channel.id
    const backupIdMatch = args[0].split('-')
    if (backupIdMatch.length < 2) return message.channel.send(usageMsg)

    const channelId: Snowflake = backupIdMatch[0]
    const timestamp: number = parseInt(backupIdMatch[1])
    for await (const entry of restoreBackup(channelId ,timestamp)) {
      const ats = entry.attachments.map((e) => new MessageAttachment(e.url ,e.name ,e))
      const embeds = entry.embeds.map((e) => new MessageEmbed(e))
      const opts: MessageAdditions = [...ats ,...embeds]
      // await client.user.setUsername(entry.author.username)
      // await client.user.setAvatar(entry.author.displayAvatarURL)
      if (opts.length === 0) {
        await message.channel.send(entry.content)
      }
      else {
        // client.user.setUsername(entry.author.username)
        await message.channel.send(entry.content ,opts)
      }
      await sleepFor(500)
    }
  }
})

// Your secret token to log the bot in. (never share this to anyone!)
client.login(settings.token)
