export const isExpired = (expirationDate: Date): boolean =>
  expirationDate.getTime() < new Date().getTime();

export const getExpirationDate = (): string => {
  const expDuration = 10 * 60 * 1000; // 10 minutes
  const expDate: number = Date.now() + expDuration;
  const res = new Date();
  res.setTime(expDate);
  return res.toISOString();
};

export const getNext1pmOr1am = (): Date => {
  const nextSyncDate = new Date();
  if (nextSyncDate.getHours() < 13) {
    nextSyncDate.setHours(13); // same day at 1pm
    nextSyncDate.setMinutes(0);
    nextSyncDate.setSeconds(0);
    nextSyncDate.setMilliseconds(0);
  } else {
    nextSyncDate.setTime(Date.now() + 24 * 3600 * 1000); // next day same hour
    nextSyncDate.setHours(1); // at 1 am
    nextSyncDate.setMinutes(0);
    nextSyncDate.setSeconds(0);
    nextSyncDate.setMilliseconds(0);
  }
  return nextSyncDate;
};

export const getNext8am = (): Date => {
  const notificationDate = new Date();
  // first get next 8am time
  if (notificationDate.getHours() < 8) {
    notificationDate.setHours(8); // same day at 8am
    notificationDate.setMinutes(0);
    notificationDate.setSeconds(0);
    notificationDate.setMilliseconds(0);
  } else {
    notificationDate.setTime(notificationDate.getTime() + 24 * 3600 * 1000); // next day same hour
    notificationDate.setHours(8); // at 8 am
    notificationDate.setMinutes(0);
    notificationDate.setSeconds(0);
    notificationDate.setMilliseconds(0);
  }

  // then allow only mondays, wednesdays and fridays
  const d = notificationDate.getDay();
  if (d == 0 || d == 2 || d == 4) {
    // sunday -> monday
    // tuesday -> wednesday
    // thursday -> friday
    notificationDate.setTime(notificationDate.getTime() + 24 * 3600 * 1000);
  } else if (d == 6) {
    // saturday -> monday
    notificationDate.setTime(notificationDate.getTime() + 48 * 3600 * 1000);
  }
  return notificationDate;
};

export const getNextMidnight = (): Date => {
  const nextSyncDate = new Date();
  nextSyncDate.setTime(Date.now() + 24 * 3600 * 1000); // next day same hour
  nextSyncDate.setHours(0);
  nextSyncDate.setMinutes(0);
  nextSyncDate.setSeconds(0);
  nextSyncDate.setMilliseconds(0);
  return nextSyncDate;
};

export const isMonday = (): boolean => {
  return new Date().getDay() === 1;
};

export const getRemainingDays = (expirationDate: string): number => {
  let expDate = new Date(new Date(expirationDate).toISOString().split('T')[0]);
  let now = new Date(new Date().toISOString().split('T')[0]);

  const timeDiff = expDate.getTime() - now.getTime();
  const daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));

  return daysDiff;
};
