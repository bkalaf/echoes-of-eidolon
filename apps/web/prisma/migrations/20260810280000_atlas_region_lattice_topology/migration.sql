CREATE TYPE "AtlasConnectionType" AS ENUM ('BASE', 'NORMAL', 'LEFT_RIGHT_CROSSOVER');
CREATE TYPE "AtlasWrapMode" AS ENUM ('NONE', 'DATE_LINE');

CREATE TABLE "RegionLatticeMapping" (
  "regionId" "RegionId" NOT NULL,
  "latticeId" "LatticeId" NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "RegionLatticeMapping_pkey" PRIMARY KEY ("regionId")
);
CREATE UNIQUE INDEX "RegionLatticeMapping_latticeId_key" ON "RegionLatticeMapping"("latticeId");

CREATE TABLE "AtlasConnection" (
  "atlasConnectionId" TEXT NOT NULL,
  "fromLatticeId" "LatticeId" NOT NULL,
  "toLatticeId" "LatticeId" NOT NULL,
  "connectionType" "AtlasConnectionType" NOT NULL,
  "wrapMode" "AtlasWrapMode" NOT NULL,
  "locked" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "AtlasConnection_pkey" PRIMARY KEY ("atlasConnectionId"),
  CONSTRAINT "AtlasConnection_distinct_ordered_endpoints_check" CHECK ("fromLatticeId" < "toLatticeId"),
  CONSTRAINT "AtlasConnection_type_wrap_check" CHECK (
    ("connectionType" = 'LEFT_RIGHT_CROSSOVER' AND "wrapMode" = 'DATE_LINE') OR
    ("connectionType" <> 'LEFT_RIGHT_CROSSOVER' AND "wrapMode" = 'NONE')
  )
);
CREATE UNIQUE INDEX "AtlasConnection_fromLatticeId_toLatticeId_key" ON "AtlasConnection"("fromLatticeId", "toLatticeId");
CREATE INDEX "AtlasConnection_fromLatticeId_idx" ON "AtlasConnection"("fromLatticeId");
CREATE INDEX "AtlasConnection_toLatticeId_idx" ON "AtlasConnection"("toLatticeId");

INSERT INTO "RegionLatticeMapping" ("regionId", "latticeId", "locked") VALUES
  ('R01', 'L03', true), ('R02', 'L01', true), ('R03', 'L02', true), ('R04', 'L04', true), ('R05', 'L08', true),
  ('R06', 'L14', true), ('R07', 'L07', true), ('R08', 'L06', true), ('R09', 'L09', true), ('R10', 'L10', true),
  ('R11', 'L15', true), ('R12', 'L20', true), ('R13', 'L24', true), ('R14', 'L19', true), ('R15', 'L05', true),
  ('R16', 'L25', true), ('R17', 'L11', true), ('R18', 'L12', true), ('R19', 'L13', true), ('R20', 'L18', true),
  ('R21', 'L17', true), ('R22', 'L23', true), ('R23', 'L21', true), ('R24', 'L16', true), ('R25', 'L22', true);

INSERT INTO "AtlasConnection" (
  "atlasConnectionId", "fromLatticeId", "toLatticeId", "connectionType", "wrapMode", "locked"
) VALUES
  ('ATLAS-CONNECTION-L01-L02', 'L01', 'L02', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L01-L06', 'L01', 'L06', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L01-L07', 'L01', 'L07', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L02-L03', 'L02', 'L03', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L02-L07', 'L02', 'L07', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L03-L04', 'L03', 'L04', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L03-L08', 'L03', 'L08', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L04-L05', 'L04', 'L05', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L04-L09', 'L04', 'L09', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L05-L09', 'L05', 'L09', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L05-L10', 'L05', 'L10', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L06-L07', 'L06', 'L07', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L06-L11', 'L06', 'L11', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L08-L12', 'L08', 'L12', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L08-L13', 'L08', 'L13', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L09-L10', 'L09', 'L10', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L10-L15', 'L10', 'L15', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L11-L12', 'L11', 'L12', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L11-L16', 'L11', 'L16', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L12-L13', 'L12', 'L13', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L13-L14', 'L13', 'L14', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L13-L18', 'L13', 'L18', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L14-L15', 'L14', 'L15', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L14-L18', 'L14', 'L18', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L15-L20', 'L15', 'L20', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L16-L17', 'L16', 'L17', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L16-L21', 'L16', 'L21', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L17-L21', 'L17', 'L21', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L17-L22', 'L17', 'L22', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L18-L23', 'L18', 'L23', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L19-L20', 'L19', 'L20', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L19-L24', 'L19', 'L24', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L19-L25', 'L19', 'L25', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L20-L25', 'L20', 'L25', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L21-L22', 'L21', 'L22', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L22-L23', 'L22', 'L23', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L23-L24', 'L23', 'L24', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L24-L25', 'L24', 'L25', 'BASE', 'NONE', true),
  ('ATLAS-CONNECTION-L01-L05', 'L01', 'L05', 'LEFT_RIGHT_CROSSOVER', 'DATE_LINE', true),
  ('ATLAS-CONNECTION-L06-L10', 'L06', 'L10', 'LEFT_RIGHT_CROSSOVER', 'DATE_LINE', true),
  ('ATLAS-CONNECTION-L11-L15', 'L11', 'L15', 'LEFT_RIGHT_CROSSOVER', 'DATE_LINE', true),
  ('ATLAS-CONNECTION-L16-L20', 'L16', 'L20', 'LEFT_RIGHT_CROSSOVER', 'DATE_LINE', true),
  ('ATLAS-CONNECTION-L21-L25', 'L21', 'L25', 'LEFT_RIGHT_CROSSOVER', 'DATE_LINE', true),
  ('ATLAS-CONNECTION-L04-L11', 'L04', 'L11', 'NORMAL', 'NONE', true);

DROP TABLE "Matrix";
