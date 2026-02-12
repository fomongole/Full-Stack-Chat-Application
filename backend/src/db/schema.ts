import { pgTable, uuid, text, timestamp, boolean, index, unique, pgEnum, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// --- ENUMS ---
export const messageTypeEnum = pgEnum('message_type', ['TEXT', 'IMAGE', 'VIDEO']);

// --- USERS TABLE ---
export const users = pgTable('user', {
    id: uuid('id').defaultRandom().primaryKey(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    username: text('username').notNull().unique(),
    about: text('about').default("Hey there! I'm using Chat App."),
    image: text('image'),
    isOnline: boolean('is_online').default(false),
    lastSeen: timestamp('last_seen').defaultNow(),
    isPrivate: boolean('is_private').default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    usernameEmailIdx: index('username_email_idx').on(table.username, table.email),
}));

// --- CONVERSATIONS TABLE ---
export const conversations = pgTable('conversation', {
    id: uuid('id').defaultRandom().primaryKey(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
    updatedAtIdx: index('updated_at_idx').on(table.updatedAt),
}));

// --- CONVERSATION PARTICIPANTS (Explicit Junction Table) ---
export const conversationParticipants = pgTable('conversation_participant', {
    userId: uuid('user_id').references(() => users.id).notNull(),
    conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
    joinedAt: timestamp('joined_at').defaultNow(),
}, (t) => ({
    pk: primaryKey({ columns: [t.userId, t.conversationId] }),
}));

// --- MESSAGES TABLE ---
export const messages = pgTable('message', {
    id: uuid('id').defaultRandom().primaryKey(),
    content: text('content'),
    authorId: uuid('author_id').references(() => users.id).notNull(),
    conversationId: uuid('conversation_id').references(() => conversations.id).notNull(),
    isRead: boolean('is_read').default(false),
    isDeleted: boolean('is_deleted').default(false),
    messageType: messageTypeEnum('message_type').default('TEXT'),
    attachmentUrl: text('attachment_url'),
    replyToId: uuid('reply_to_id'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    // Optimized indexes for history fetching and unread counts
    convoCreatedIdx: index('convo_created_idx').on(table.conversationId, table.createdAt),
    convoReadIdx: index('convo_read_idx').on(table.conversationId, table.isRead),
}));

// --- BLOCKS TABLE ---
export const blocks = pgTable('block', {
    id: uuid('id').defaultRandom().primaryKey(),
    blockerId: uuid('blocker_id').references(() => users.id).notNull(),
    blockedId: uuid('blocked_id').references(() => users.id).notNull(),
    // Frozen Snapshot: Stores the state of the blocked user at the moment of blocking
    frozenPayload: jsonb('frozen_payload'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
    uniqueBlock: unique('blocker_blocked_unique').on(table.blockerId, table.blockedId),
    blockerIdx: index('blocker_idx').on(table.blockerId),
    blockedIdx: index('blocked_idx').on(table.blockedId),
}));

// --- RELATIONS DEFINITIONS ---

export const usersRelations = relations(users, ({ many }) => ({
    conversationParticipants: many(conversationParticipants),
    messages: many(messages),
    blockedUsers: many(blocks, { relationName: 'blocker' }),
    blockedBy: many(blocks, { relationName: 'blocked' }),
}));

export const conversationsRelations = relations(conversations, ({ many }) => ({
    participants: many(conversationParticipants),
    messages: many(messages),
}));

export const conversationParticipantsRelations = relations(conversationParticipants, ({ one }) => ({
    user: one(users, { fields: [conversationParticipants.userId], references: [users.id] }),
    conversation: one(conversations, { fields: [conversationParticipants.conversationId], references: [conversations.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    author: one(users, { fields: [messages.authorId], references: [users.id] }),
    conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
    replyTo: one(messages, { fields: [messages.replyToId], references: [messages.id], relationName: 'reply' }),
    replies: many(messages, { relationName: 'reply' }),
}));

export const blocksRelations = relations(blocks, ({ one }) => ({
    blocker: one(users, { fields: [blocks.blockerId], references: [users.id], relationName: 'blocker' }),
    blocked: one(users, { fields: [blocks.blockedId], references: [users.id], relationName: 'blocked' }),
}));