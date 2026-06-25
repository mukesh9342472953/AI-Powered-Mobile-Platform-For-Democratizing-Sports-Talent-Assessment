const SPORT_MAP = {
  cricket: "Cricket",
  football: "Football",
  soccer: "Football",
  tennis: "Tennis",
  badminton: "Badminton",
  athletics: "Athletics",
  run: "Athletics",
  sprint: "Athletics",
  track: "Athletics",
  basketball: "Basketball",
  volleyball: "Volleyball",
  hockey: "Hockey",
  "table tennis": "Table Tennis",
  tabletennis: "Table Tennis",
  kabaddi: "Kabaddi",
  swimming: "Swimming",
  swim: "Swimming",
  boxing: "Boxing",
  wrestling: "Wrestling",
  archery: "Archery",
  shooting: "Shooting",
  chess: "Chess",
  rugby: "Rugby",
  handball: "Handball",
  cycling: "Cycling",
  gymnastics: "Gymnastics",
  gym: "Gymnastics",
  weightlifting: "Weightlifting",
  taekwondo: "Taekwondo",
  karate: "Karate",
  judo: "Judo",
  fencing: "Fencing",
  skating: "Skating",
  skat: "Skating",
  surfing: "Surfing",
  surf: "Surfing",
  baseball: "Baseball",
  softball: "Softball",
  golf: "Golf"
};

class SportDetectionService {
  static detectSport(video, selectedSport) {
    if (!video) return null;
    const name = (video.original_name || video.filename || "").toLowerCase();

    // 1. Normalize name and look up mapping
    let matchedSport = null;
    for (const [keyword, mappedName] of Object.entries(SPORT_MAP)) {
      if (name.includes(keyword)) {
        matchedSport = mappedName;
        break;
      }
    }

    // 2. Mock AI Top-N Prediction & Confidence Score
    let topPrediction = "";
    let confidence = 0.0;

    if (matchedSport) {
      topPrediction = matchedSport;
      confidence = 0.95; // 95%
    } else if (selectedSport) {
      topPrediction = SportDetectionService.normalize(selectedSport);
      confidence = 0.85; // 85% (Above 70% threshold -> Accepts by default)
    } else {
      topPrediction = "Cricket";
      confidence = 0.50; // Low confidence
    }

    return {
      sport: topPrediction,
      confidence: confidence,
      predictions: [
        { sport: topPrediction, confidence: confidence },
        { sport: topPrediction === "Cricket" ? "Football" : "Cricket", confidence: 1 - confidence }
      ]
    };
  }

  static validateSport(selectedSport, detectedSportInfo) {
    if (!selectedSport || !detectedSportInfo) return false;
    
    // Normalize both sports before comparing
    const normalizedSelected = SportDetectionService.normalize(selectedSport);
    const normalizedDetected = SportDetectionService.normalize(detectedSportInfo.sport);

    // Reject if confidence is below 70% (0.70)
    if (detectedSportInfo.confidence < 0.70) {
      return false;
    }

    return normalizedSelected === normalizedDetected;
  }

  static normalize(sportName) {
    if (!sportName) return "";
    let clean = sportName.toLowerCase().trim();
    // Strip suffixes like " sport", " match", " training", " video", etc.
    clean = clean.replace(/(?: sport| match| training| video| game)$/i, "");
    
    // Check SPORT_MAP
    if (SPORT_MAP[clean]) {
      return SPORT_MAP[clean];
    }
    
    // Try substring matching
    for (const [keyword, mappedName] of Object.entries(SPORT_MAP)) {
      if (clean.includes(keyword)) {
        return mappedName;
      }
    }

    // Capitalize first letter as fallback
    return sportName.charAt(0).toUpperCase() + sportName.slice(1);
  }
}

module.exports = SportDetectionService;
