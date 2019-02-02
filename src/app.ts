import * as Octokit from '@octokit/rest';
import { RDS } from 'aws-sdk';
import { difference } from 'lodash';
import { createInterface } from 'readline';
import * as teamMap  from './teams.json';

const getOpenPulls = async (githubToken: string) => {
  const octokit = new Octokit({ auth: `token ${githubToken}` });
  return await octokit.pulls.list({ owner: 'cleodev', repo: 'crowsnest', state: 'open' });
};

const shutdownPullRds = async (region: string, pulls: { num: number; title: string; author: string; }[], skipPrompt = false) => {
  const rds = new RDS({ region });

  const cin = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  if (!skipPrompt) {
    const shouldShutdown = await new Promise(resolve => {
      const descriptions = pulls
        .map(pull => `[${pull.num}](https://github.com/CleoDev/crowsnest/pull/${pull.num}) -- @${pull.author} -- ${pull.title}`)
        .join('\n');

      cin.question(
        `Are you sure you want to shutdown the DB for the following PRs (y/n): \n${descriptions}\n`,
        answer => resolve(answer.toLowerCase() === 'y')
      );
    });

    if (!shouldShutdown) {
      console.log('Canceling shutdown...');
      return;
    }
  }

  for (const pull of pulls) {
    const dbId = `b2biaas-pr${pull.num}`;
    try {
      const { DBInstances } = await rds.describeDBInstances({
        DBInstanceIdentifier: dbId,
        MaxRecords: 20
      }).promise();

      if (DBInstances.length) {
        const database = DBInstances[0];
        const isSmall =
          database.DBInstanceClass.endsWith('.small') || database.DBInstanceClass.endsWith('.micro');

        if (database.DBInstanceStatus === 'available' && !isSmall) {
          console.log(`Shutting down db ${dbId}`);
          await rds.stopDBInstance({ DBInstanceIdentifier: dbId }).promise();
        } else {
          console.log(`Skipping shut down for ${dbId}. The DB is either not available or is below a t2.medium`);
        }
      }
    } catch (error) {
      if (error.code !== 'DBInstanceNotFound') {
        console.debug(`Unable to list instance for db instance with id "${dbId}"`, error);
        throw error;
      } else {
        console.log(`DB ${dbId} does not exist. Skipping shutdown`);
      }
    }
  }
};

const startUpRds = async (region: string, pulls: { num: number; title: string; author: string; }[], skipPrompt = false) => {
  throw new Error('Not Implemented Yet');
};

export const main = async (options: {
  region: string;
  githubToken: string;
  cycle: 'START' | 'SHUTDOWN';
  teams: Array<'MEATBALLS' | 'SLYTHERINS' | "INCOGNITOS">;
  skipPrs: number[];
  skipPrompt: boolean;
}) => {
  const openPulls = await getOpenPulls(options.githubToken);
  const people: string[] = options.teams
    .reduce((accum, teamName) => [...accum, ...teamMap[teamName]], [])
    .map(person => person.toLowerCase());
  const teamPulls = openPulls.data.filter(pull => people.indexOf(pull.user.login.toLowerCase()) >= 0);
  const pulls = teamPulls.map(pull => ({
    num: pull.number,
    title: pull.title,
    author: pull.user.login,
  }));
  const pullsWithoutSkipped = pulls.filter(pull => (options.skipPrs || []).indexOf(pull.num) < 0);

  switch (options.cycle) {
    case 'START':
      await startUpRds(options.region, pullsWithoutSkipped, options.skipPrompt);
      break;

    case 'SHUTDOWN':
      await shutdownPullRds(options.region, pullsWithoutSkipped, options.skipPrompt);
      break;

    default:
      console.error('cycle option must be either SHUTDOWN or STARTUP');
      process.exit(1);
      break;
  }
};