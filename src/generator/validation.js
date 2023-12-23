import { isFile }             from '@typhonjs-utils/file-util';
import {
   isIterable,
   isObject }                 from '@typhonjs-utils/object';
import { getPackageWithPath } from '@typhonjs-utils/package-json';
import path                   from 'upath';

import { linkPluginMap }      from './typedoc.js';
import ts                     from 'typescript';

import { Logger }             from '#util';

// Only allow standard JS / TS files.
export const regexAllowedFiles = /\.(js|mjs|ts|mts)$/;
export const regexIsDTSFile = /\.d\.(cts|ts|mts)$/;

/**
 * Validates the TS compiler options.
 *
 * @param {import('type-fest').TsConfigJson.CompilerOptions} compilerOptions - The TS compiler options.
 *
 * @returns {ts.CompilerOptions} The validated compiler options or undefined if failure.
 */
export function validateCompilerOptions(compilerOptions)
{
   // Validate `config.compilerOptions` ------------------------------------------------------------------------------

   // Use the current working directory as the base path.
   const basePath = process.cwd();

   const { options, errors } = ts.convertCompilerOptionsFromJson(compilerOptions, basePath);

   if (errors.length > 0)
   {
      for (const err of errors) { Logger.error(`[TS] ${ts.flattenDiagnosticMessageText(err.messageText, '\n')}`); }
      return void 0;
   }

   return options;
}

/**
 * Validates all config object parameters.
 *
 * @param {import('./').GenerateConfig} config - A generate config.
 *
 * @returns {boolean} Validation state.
 */
export function validateConfig(config)
{
   if (config.dmtNavStyle !== void 0 && config.dmtNavStyle !== 'compact' && config.dmtNavStyle !== 'flat')
   {
      Logger.error(`Error: 'dmtNavStyle' must be 'compact' or 'flat'.`);
      return false;
   }

   if (typeof config.exportCondition !== 'string')
   {
      Logger.error(`Error: 'exportCondition' must be a string.`);
      return false;
   }

   if (typeof config.output !== 'string')
   {
      Logger.error(`Error: 'output' must be a string.`);
      return false;
   }

   if (config.packageName !== void 0 && typeof config.packageName !== 'string')
   {
      Logger.error(`Error: 'packageName' must be a string.`);
      return false;
   }

   if (config.path !== void 0)
   {
      if (typeof config.path !== 'string')
      {
         Logger.error(`Error: 'path' must be a string.`);
         return false;
      }

      const unixPath = path.toUnix(config.path);

      if (!isFile(unixPath))
      {
         Logger.error(`Error: 'path' is not a file; ${unixPath}`);
         return false;
      }

      if (!(regexIsDTSFile.test(unixPath) || regexAllowedFiles.test(unixPath) || unixPath.endsWith('package.json')))
      {
         Logger.error(`Error: 'path' is not an allowed entry point or 'package.json' file; ${unixPath}`);
         return false;
      }
   }
   else
   {
      // Find local `package.json`
      const cwd = process.cwd();

      // Find local `package.json` only.
      const { packageObj, filepath } = getPackageWithPath({ filepath: cwd, basepath: cwd });

      if (!packageObj)
      {
         Logger.error(`No 'package.json' found in: ${path.toUnix(cwd)}`);
         return false;
      }

      config.path = path.toUnix(filepath);
   }

   if (config.tsconfigPath !== void 0 && !isFile(config.tsconfigPath))
   {
      Logger.error(`Error: 'tsconfigPath' is not a file; ${config.tsconfigPath}`);
      return false;
   }

   if (config.typedocOptions !== void 0 && !isObject(config.typedocOptions))
   {
      Logger.error(`Error: 'typedocOptions' is not an object.`);
      return false;
   }

   if (config.typedocPath !== void 0 && !isFile(config.typedocPath))
   {
      Logger.error(`Error: 'typedocPath' is not a file; ${config.typedocPath}`);
      return false;
   }

   // Process `linkPlugins` last as there is additional verbose logging.
   if (config.linkPlugins !== void 0)
   {
      const plugins = [];

      if (!isIterable(config.linkPlugins))
      {
         Logger.error(`Error: 'linkPlugins' must be an iterable list.`);
         return false;
      }

      const entries = new Set(Array.from(config.linkPlugins));

      // Detect when dom and worker are configured together as they are exclusive.
      if (entries.has('dom') && entries.has('worker'))
      {
         Logger.error(
          `API link error: You may only include either 'dom' or 'worker' for the DOM API or Web Worker API.`);
         return false;
      }

      for (const entry of entries)
      {
         if (!linkPluginMap.has(entry))
         {
            Logger.warn(`API Link warning: Unknown API link '${entry}'.`);
            continue;
         }

         Logger.verbose(`Adding API link plugin '${entry}': ${linkPluginMap.get(entry)}`);
         plugins.push(linkPluginMap.get(entry));
      }

      config.linkPlugins = plugins;
   }

   return true;
}
