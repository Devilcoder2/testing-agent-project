CREATE UNIQUE INDEX "Notification_recipientId_runId_type_key" ON "Notification"("recipientId", "runId", "type");
CREATE UNIQUE INDEX "Notification_recipientId_releaseRunId_type_key" ON "Notification"("recipientId", "releaseRunId", "type");
