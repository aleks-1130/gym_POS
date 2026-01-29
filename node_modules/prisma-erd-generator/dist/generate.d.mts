import { GeneratorOptions } from '@prisma/generator-helper';

interface DMLModel {
    name: string;
    isEmbedded?: boolean;
    dbName: string | null;
    fields: DMLField[];
    idFields?: unknown[];
    uniqueFields?: unknown[];
    uniqueIndexes?: unknown[];
    isGenerated?: boolean;
    primaryKey?: {
        name: string | null;
        fields: string[];
    } | null;
}
interface DMLField {
    name: string;
    hasDefaultValue: boolean;
    isGenerated: boolean;
    isId: boolean;
    isList: boolean;
    isReadOnly: boolean;
    isRequired: boolean;
    isUnique: boolean;
    isUpdatedAt: boolean;
    kind: 'scalar' | 'object' | 'enum';
    type: string;
    relationFromFields?: unknown[];
    relationName?: string;
    relationOnDelete?: string;
    relationToFields?: unknown[];
    default?: unknown;
}

declare const extractViewNames: (dataModel: string) => string[];
/**
 * Converts a glob-like pattern to a RegExp
 * Supports: * (any characters), ? (single character), exact names
 * Examples:
 *   "sys_*" matches "sys_logs", "sys_audit"
 *   "_*" matches "_prisma_migrations", "_internal"
 *   "temp_?" matches "temp_1", "temp_a"
 *   "Session" matches exactly "Session"
 */
declare const patternToRegex: (pattern: string) => RegExp;
/**
 * Check if a model name matches any of the ignore patterns
 */
declare const matchesIgnorePattern: (modelName: string, patterns: string[]) => boolean;
declare const mapPrismaToDb: (dmlModels: DMLModel[], dataModel: string) => {
    fields: DMLField[];
    name: string;
    isEmbedded?: boolean;
    dbName: string | null;
    idFields?: unknown[];
    uniqueFields?: unknown[];
    uniqueIndexes?: unknown[];
    isGenerated?: boolean;
    primaryKey?: {
        name: string | null;
        fields: string[];
    } | null;
}[];
declare const _default: (options: GeneratorOptions) => Promise<void>;

export { _default as default, extractViewNames, mapPrismaToDb, matchesIgnorePattern, patternToRegex };
