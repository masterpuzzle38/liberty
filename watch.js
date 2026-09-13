(() => {
  const timeEl = document.getElementById("watch-time");
  const dateEl = document.getElementById("watch-date");
  const nameEl = document.getElementById("watch-name");
  const fillEl = document.getElementById("watch-fill");
  if (!timeEl || !dateEl || !nameEl || !fillEl) return;

  const zone = "America/New_York";

  const watches = [
    { name: "Midwatch", start: 0, hours: 4 },
    { name: "Morning", start: 4, hours: 4 },
    { name: "Forenoon", start: 8, hours: 4 },
    { name: "Afternoon", start: 12, hours: 4 },
    { name: "First dog", start: 16, hours: 2 },
    { name: "Last dog", start: 18, hours: 2 },
    { name: "First", start: 20, hours: 4 },
  ];

  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const dateFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const partsFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  function easternParts(now) {
    const parts = { hour: 0, minute: 0, second: 0 };
    for (const part of partsFmt.formatToParts(now)) {
      if (part.type in parts) parts[part.type] = Number(part.value);
    }
    return parts;
  }

  function currentWatch(hour) {
    return watches.find((watch) => {
      const end = watch.start + watch.hours;
      return hour >= watch.start && hour < end;
    }) || watches[0];
  }

  function tick() {
    const now = new Date();
    const { hour, minute, second } = easternParts(now);
    const watch = currentWatch(hour);
    const elapsed = (hour - watch.start) * 3600 + minute * 60 + second;
    const progress = Math.min(1, elapsed / (watch.hours * 3600));

    timeEl.textContent = timeFmt.format(now);
    timeEl.dateTime = now.toISOString();
    dateEl.textContent = dateFmt.format(now);
    nameEl.textContent = watch.name;
    fillEl.style.width = `${progress * 100}%`;
  }

  tick();
  setInterval(tick, 1000);
})();
