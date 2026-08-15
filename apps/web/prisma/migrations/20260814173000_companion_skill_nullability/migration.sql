-- Skill participation is authored by nullable data. Existing assignments remain unchanged.
ALTER TABLE "CompanionDef"
  ALTER COLUMN "knowledgeSkill" DROP NOT NULL,
  ALTER COLUMN "awarenessSkill" DROP NOT NULL;
