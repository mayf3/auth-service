import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

function readJson(bundleDir, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(bundleDir, relativePath), 'utf8'));
}

function formatErrors(errors) {
  return (errors ?? [])
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ');
}

export function compileBundleSchemas(bundleDir, schemaFiles) {
  const ajv = new Ajv2020({
    allErrors: true,
    allowUnionTypes: true,
    strict: true,
    strictRequired: false,
  });
  addFormats(ajv);

  const validators = new Map();
  for (const schemaFile of schemaFiles) {
    const relativePath = `schemas/${schemaFile}`;
    const schema = readJson(bundleDir, relativePath);
    if (!ajv.validateSchema(schema)) {
      throw new Error(`${schemaFile}: invalid JSON Schema: ${formatErrors(ajv.errors)}`);
    }
    validators.set(schemaFile, ajv.compile(schema));
  }
  return validators;
}

export function assertSchemaInstance(validators, schemaFile, value, instanceId) {
  const validate = validators.get(schemaFile);
  if (!validate) throw new Error(`${instanceId}: unknown schema ${schemaFile}`);
  if (!validate(value)) {
    throw new Error(`${instanceId}: ${schemaFile}: ${formatErrors(validate.errors)}`);
  }
}
