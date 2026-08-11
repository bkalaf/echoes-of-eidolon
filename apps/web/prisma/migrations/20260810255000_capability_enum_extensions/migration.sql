-- PostgreSQL requires newly added enum values to commit before later migrations use them.
ALTER TYPE "CapabilityOperation" ADD VALUE IF NOT EXISTS 'CLEAR';
ALTER TYPE "CapabilityRequirementOperator" ADD VALUE IF NOT EXISTS 'NOT_EXISTS';
ALTER TYPE "CapabilityRequirementOperator" ADD VALUE IF NOT EXISTS 'IN';
ALTER TYPE "CapabilityRequirementOperator" ADD VALUE IF NOT EXISTS 'NOT_IN';
