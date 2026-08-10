(() => {
  try {
    const oldScenarios = JSON.parse(localStorage.getItem("39x2_scenarios_v2") || "[]");
    if (Array.isArray(oldScenarios) && oldScenarios.length && !localStorage.getItem("39x2_scenarios_v3")) {
      localStorage.setItem("39x2_scenarios_v3", JSON.stringify(oldScenarios));
    }
    const oldAlbum = JSON.parse(localStorage.getItem("39x2_album_v1") || "[]");
    if (Array.isArray(oldAlbum) && oldAlbum.length && !localStorage.getItem("39x2_album_v2")) {
      const migrated = oldAlbum.map(x => ({
        schemaVersion: 1,
        id: x.id,
        eventId: "",
        scenarioId: "",
        title: x.title || "",
        date: x.date || "",
        system: x.system || "",
        role: x.role || "PL",
        pcName: x.pc || x.pcName || "",
        participants: x.people || x.participants || [],
        imageUrls: x.image ? [x.image] : (x.imageUrls || []),
        comment: x.comment || "",
        spoiler: x.spoiler || "",
        externalLinks: [],
        visibility: x.visibility || "private",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      localStorage.setItem("39x2_album_v2", JSON.stringify(migrated));
    }
  } catch {}
})();