import { Message ,MessageAttachment ,MessageEmbed ,MessageReaction ,ReactionUserStore ,Snowflake ,User } from 'discord.js'

// 1 Transform the type to flag all the undesired keys as 'never'
type FlagExcludedType<Base ,Type> = { [Key in keyof Base]: Base[Key] extends Type ? never : Key }

// 2 Get the keys that are not flagged as 'never'
type AllowedNames<Base ,Type> = FlagExcludedType<Base ,Type>[keyof Base]

// 3 Use this with a simple Pick to get the right interface, excluding the undesired type
type OmitType<Base ,Type> = Pick<Base ,AllowedNames<Base ,Type>>

interface ReactionEntry extends Omit< OmitType<MessageReaction ,Function> // Why did I have to specify all the functions
,'users'> {
  users: OmitType<User ,Function>[]
}
interface UserEntry extends OmitType<User ,Function>{
  displayAvatarURL: string
  avatarURL: string
}
interface DiscordBackupEntry extends Omit< OmitType<Message ,Function> // Why did I have to specify all the functions
,'attachments'|'reactions'|'channel'|'avatar'> {
  attachments: OmitType<MessageAttachment ,Function>[]
  reactions: ReactionEntry[]
  embeds: MessageEmbed[]
  channel: undefined
  author: UserEntry
}
declare const enum BackupYieldType {
  Started=0
  ,Progress=1
  ,Finished=2
}
declare const enum RestoreYieldType {
  Started=0
  ,Progress=1
  ,Finished=2
}
interface BackupYieldBase {
  type: BackupYieldType
  path: string
  channel: Snowflake
  timestamp: number
}
interface BackupYieldStart extends BackupYieldBase{
  type: BackupYieldType.Started
}
interface BackupYieldEnd extends BackupYieldBase {
  type: BackupYieldType.Finished
}
interface BackupYieldProgress extends BackupYieldBase {
  type: BackupYieldType.Progress
}
type BackupYield = BackupYieldStart|BackupYieldProgress|BackupYieldEnd

interface RestoreYieldStart {
  type: RestoreYieldType.Started
  path: string
  channel: Snowflake
}
interface RestoreYieldEnd {
  type: RestoreYieldType.Finished
  path: string
  channel: Snowflake
}
interface RestoreYieldProgress {
  type: RestoreYieldType.Progress
  path: string
  channel: Snowflake
}
type RestoreYield = RestoreYieldStart|RestoreYieldProgress|RestoreYieldEnd

interface Settings {
  ownerId: Snowflake
  token: string
  saveDir: string
  prefix: string
}