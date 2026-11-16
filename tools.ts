import createIssue from "./tools/createIssue.ts";
import deleteIssue from "./tools/deleteIssue.ts";
import getIssue from "./tools/getIssue.ts";
import listAudiences from "./tools/listAudiences.ts";
import listIssues from "./tools/listIssues.ts";
import scheduleIssue from "./tools/scheduleIssue.ts";
import selectNewsletter from "./tools/selectNewsletter.ts";
import sendIssue from "./tools/sendIssue.ts";
import updateIssue from "./tools/updateIssue.ts";

export default [listIssues, getIssue, listAudiences, selectNewsletter, createIssue, updateIssue, deleteIssue, scheduleIssue, sendIssue];
