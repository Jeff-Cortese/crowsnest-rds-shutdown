import * as Octokit from '@octokit/rest';
import { RDS } from 'aws-sdk';
import { difference } from 'lodash';
import * as teamMap  from './teams.json';


const getOpenPulls = async (githubToken: string) => {
  const octokit = new Octokit({ auth: `token ${githubToken}` });
  return await octokit.pulls.list({ owner: 'cleodev', repo: 'crowsnest', state: 'open' });
};

const shutdownPullRds = async (region: string, prNumbers: number[]) => {
  const rds = new RDS({ region });

  for (const prNum of prNumbers) {
    const dbId = `b2biaas-pr${prNum}`;
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

const startUpRds = async (region: string, prNumbers: number[]) => {
  throw new Error('Not Implemented Yet');
};

export const main = async (options: {
  region: string;
  githubToken: string;
  cycle: 'START' | 'SHUTDOWN';
  teams: Array<'MEATBALLS' | 'SLYTHERINS' | "INCOGNITOS">;
  skipPrs: number[];
}) => {
  const openPulls = await getOpenPulls(options.githubToken);
  const people: string[] = options.teams.reduce((accum, teamName) => [...accum, ...teamMap[teamName]], []);
  const teamPulls = openPulls.data.filter(pull => people.indexOf(pull.user.login) >= 0);
  const pullNumbers = teamPulls.map(pull => pull.number);
  const pullsWithoutSkipped = difference(pullNumbers, options.skipPrs || []);

  switch (options.cycle) {
    case 'START':
      await startUpRds(options.region, pullsWithoutSkipped);
      break;

    case 'SHUTDOWN':
      await shutdownPullRds(options.region, pullsWithoutSkipped);
      break;
  }
};