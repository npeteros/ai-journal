#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/c2548a472182a735cf91b148c174b75e99df3ce40a12e4661becb23264643077/contract';
import endContract from '../../snapshots/c2548a472182a735cf91b148c174b75e99df3ce40a12e4661becb23264643077/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'aiProcessingLogEntry',
        columns: [
          col('entryId', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('feature', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('payloadSummary', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('requestedAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('responseSummary', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('success', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'aiProcessingLogEntry_feature_check_b65c4da6',
            "\"feature\" IN ('sentiment_tagging', 'tag_suggestion', 'summary', 'chat_with_journal', 'minds_comments', 'trend_analysis', 'topic_detection', 'personality_insights', 'growth_suggestions', 'weekly_digest')",
          ),
          checkExpression(
            'aiProcessingLogEntry_provider_check_b91ed006',
            "\"provider\" IN ('openai', 'anthropic')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'aiUsageCounter',
        columns: [
          col('callCount', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('date', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'chatMessage',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('role', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sessionId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression('chatMessage_role_check_207dfd80', "\"role\" IN ('user', 'assistant')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'chatMessageSourceEntry',
        columns: [
          col('entryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('messageId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['messageId', 'entryId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'chatSession',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('title', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'emotionTrend',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('dominantEmotion', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('periodEnd', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('periodStart', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('periodType', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('summary', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'emotionTrend_dominantEmotion_check_e41eda26',
            "\"dominantEmotion\" IN ('joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral')",
          ),
          checkExpression(
            'emotionTrend_periodType_check_909e8ad8',
            "\"periodType\" IN ('week', 'month', 'season')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'entry',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'entryAnalysis',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('primaryEmotion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentimentScore', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'entryAnalysis_primaryEmotion_check_256378c4',
            "\"primaryEmotion\" IN ('joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'entryEmotionScore',
        columns: [
          col('analysisId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('emotion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('score', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'entryEmotionScore_emotion_check_a972a53d',
            "\"emotion\" IN ('joy', 'sadness', 'anger', 'fear', 'surprise', 'disgust', 'neutral')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'entrySummaryBullet',
        columns: [
          col('entryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('position', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('text', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'entryTag',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('source', 'text', {
            notNull: true,
            default: lit('manual'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('tagId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['entryId', 'tagId']),
          checkExpression(
            'entryTag_source_check_2163fedd',
            "\"source\" IN ('manual', 'ai_suggested')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'growthSuggestion',
        columns: [
          col('acknowledged', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('category', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'mindsComment',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('entryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('perspective', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('provider', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'mindsComment_provider_check_b91ed006',
            "\"provider\" IN ('openai', 'anthropic')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'personalityInsight',
        columns: [
          col('agreeableness', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('conscientiousness', 'float8', {
            notNull: true,
            codecRef: { codecId: 'pg/float8@1' },
          }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('extraversion', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('model', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('neuroticism', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('openness', 'float8', { notNull: true, codecRef: { codecId: 'pg/float8@1' } }),
          col('summary', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'recurringTopic',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('description', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('firstSeenAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('label', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastSeenAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('occurrenceCount', 'int4', {
            notNull: true,
            default: lit(1),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'recurringTopicEntry',
        columns: [
          col('entryId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('topicId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['topicId', 'entryId'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'tag',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('name', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'user',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('currentStreak', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('deletedAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('displayName', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('lastEntryDate', 'date', { codecRef: { codecId: 'pg/date-string@1' } }),
          col('longestStreak', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('passwordHash', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('reminderChannel', 'text', {
            notNull: true,
            default: lit('browser'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('reminderEnabled', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('reminderTime', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('theme', 'text', {
            notNull: true,
            default: lit('light'),
            codecRef: { codecId: 'pg/text@1' },
          }),
          col('updatedAt', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'user_reminderChannel_check_0762b15d',
            "\"reminderChannel\" IN ('browser', 'email')",
          ),
          checkExpression('user_theme_check_753234b6', "\"theme\" IN ('light', 'dark')"),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'weeklyDigest',
        columns: [
          col('content', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-string@1' },
          }),
          col('id', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('sentAt', 'timestamptz', { codecRef: { codecId: 'pg/timestamptz-string@1' } }),
          col('userId', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('weekEnd', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
          col('weekStart', 'date', { notNull: true, codecRef: { codecId: 'pg/date-string@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'aiUsageCounter',
        constraint: 'aiUsageCounter_userId_date_key',
        columns: ['userId', 'date'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'emotionTrend',
        constraint: 'emotionTrend_userId_periodType_periodStart_key',
        columns: ['userId', 'periodType', 'periodStart'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'entryAnalysis',
        constraint: 'entryAnalysis_entryId_key',
        columns: ['entryId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'entryEmotionScore',
        constraint: 'entryEmotionScore_analysisId_emotion_key',
        columns: ['analysisId', 'emotion'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'entrySummaryBullet',
        constraint: 'entrySummaryBullet_entryId_position_key',
        columns: ['entryId', 'position'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'recurringTopic',
        constraint: 'recurringTopic_userId_label_key',
        columns: ['userId', 'label'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'tag',
        constraint: 'tag_userId_name_key',
        columns: ['userId', 'name'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'user',
        constraint: 'user_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'weeklyDigest',
        constraint: 'weeklyDigest_userId_weekStart_key',
        columns: ['userId', 'weekStart'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'aiProcessingLogEntry',
        index: 'aiProcessingLogEntry_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'aiProcessingLogEntry',
        index: 'aiProcessingLogEntry_userId_requestedAt_idx_e6aba982',
        columns: ['userId', 'requestedAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'aiUsageCounter',
        index: 'aiUsageCounter_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessage',
        index: 'chatMessage_sessionId_createdAt_idx_9c04f880',
        columns: ['sessionId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessage',
        index: 'chatMessage_sessionId_idx_29f415d4',
        columns: ['sessionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessageSourceEntry',
        index: 'chatMessageSourceEntry_entryId_idx_8b42d1db',
        columns: ['entryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatMessageSourceEntry',
        index: 'chatMessageSourceEntry_messageId_idx_3cdded8d',
        columns: ['messageId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'chatSession',
        index: 'chatSession_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'emotionTrend',
        index: 'emotionTrend_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entry',
        index: 'entry_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entry',
        index: 'entry_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entryEmotionScore',
        index: 'entryEmotionScore_analysisId_idx_11b47406',
        columns: ['analysisId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entrySummaryBullet',
        index: 'entrySummaryBullet_entryId_idx_8b42d1db',
        columns: ['entryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entryTag',
        index: 'entryTag_entryId_idx_8b42d1db',
        columns: ['entryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'entryTag',
        index: 'entryTag_tagId_idx_86854244',
        columns: ['tagId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'growthSuggestion',
        index: 'growthSuggestion_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'growthSuggestion',
        index: 'growthSuggestion_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'mindsComment',
        index: 'mindsComment_entryId_idx_8b42d1db',
        columns: ['entryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'personalityInsight',
        index: 'personalityInsight_userId_createdAt_idx_f726f04a',
        columns: ['userId', 'createdAt'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'personalityInsight',
        index: 'personalityInsight_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurringTopic',
        index: 'recurringTopic_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurringTopicEntry',
        index: 'recurringTopicEntry_entryId_idx_8b42d1db',
        columns: ['entryId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'recurringTopicEntry',
        index: 'recurringTopicEntry_topicId_idx_6f05808f',
        columns: ['topicId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'tag',
        index: 'tag_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'weeklyDigest',
        index: 'weeklyDigest_userId_idx_a489d58a',
        columns: ['userId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'aiProcessingLogEntry',
        foreignKey: {
          name: 'aiProcessingLogEntry_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'aiUsageCounter',
        foreignKey: {
          name: 'aiUsageCounter_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chatMessage',
        foreignKey: {
          name: 'chatMessage_sessionId_fkey',
          columns: ['sessionId'],
          references: { schema: 'public', table: 'chatSession', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chatMessageSourceEntry',
        foreignKey: {
          name: 'chatMessageSourceEntry_messageId_fkey',
          columns: ['messageId'],
          references: { schema: 'public', table: 'chatMessage', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chatMessageSourceEntry',
        foreignKey: {
          name: 'chatMessageSourceEntry_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'entry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'chatSession',
        foreignKey: {
          name: 'chatSession_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'emotionTrend',
        foreignKey: {
          name: 'emotionTrend_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entry',
        foreignKey: {
          name: 'entry_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entryAnalysis',
        foreignKey: {
          name: 'entryAnalysis_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'entry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entryEmotionScore',
        foreignKey: {
          name: 'entryEmotionScore_analysisId_fkey',
          columns: ['analysisId'],
          references: { schema: 'public', table: 'entryAnalysis', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entrySummaryBullet',
        foreignKey: {
          name: 'entrySummaryBullet_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'entry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entryTag',
        foreignKey: {
          name: 'entryTag_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'entry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'entryTag',
        foreignKey: {
          name: 'entryTag_tagId_fkey',
          columns: ['tagId'],
          references: { schema: 'public', table: 'tag', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'growthSuggestion',
        foreignKey: {
          name: 'growthSuggestion_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'mindsComment',
        foreignKey: {
          name: 'mindsComment_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'entry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'personalityInsight',
        foreignKey: {
          name: 'personalityInsight_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurringTopic',
        foreignKey: {
          name: 'recurringTopic_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurringTopicEntry',
        foreignKey: {
          name: 'recurringTopicEntry_topicId_fkey',
          columns: ['topicId'],
          references: { schema: 'public', table: 'recurringTopic', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'recurringTopicEntry',
        foreignKey: {
          name: 'recurringTopicEntry_entryId_fkey',
          columns: ['entryId'],
          references: { schema: 'public', table: 'entry', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'tag',
        foreignKey: {
          name: 'tag_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'weeklyDigest',
        foreignKey: {
          name: 'weeklyDigest_userId_fkey',
          columns: ['userId'],
          references: { schema: 'public', table: 'user', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
