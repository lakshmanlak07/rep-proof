// Citations from the PRD. The app links a reference only when `doi` is set.
// Every entry must be re-checked against its DOI page before release (PRD rule).
// Entries without a DOI are still "to confirm": fill the DOI after looking it up.

export type Reference = {
  id: string;
  citation: string;
  doi?: string;
};

export const REFERENCES: Record<string, Reference> = {
  frequency_meta: {
    id: 'frequency_meta',
    citation:
      'Schoenfeld, Grgic & Krieger (2019). How many times per week should a muscle be trained to maximize muscle hypertrophy? J Sports Sci 37(11):1286-1295.',
  },
  frequency_3v6: {
    id: 'frequency_3v6',
    citation:
      'Saric et al. (2019). Resistance training frequencies of 3 and 6 times per week produce similar muscular adaptations in resistance-trained men. JSCR 33(7S):S122-S129.',
    doi: '10.1519/JSC.0000000000002909',
  },
  volume_dose: {
    id: 'volume_dose',
    citation: 'Schoenfeld, Ogborn & Krieger (2017). Weekly volume dose-response meta-analysis.',
  },
  rir_autoreg: {
    id: 'rir_autoreg',
    citation:
      'Graham & Cleather (2019). Autoregulation by "repetitions in reserve" leads to greater improvements in strength over a 12-week training program than fixed loading. JSCR.',
    doi: '10.1519/JSC.0000000000003164',
  },
  rir_accuracy: {
    id: 'rir_accuracy',
    citation:
      'Halperin et al. (2022). Accuracy in predicting repetitions to task failure in resistance exercise: a scoping review and exploratory meta-analysis. Sports Medicine.',
  },
  checkins: {
    id: 'checkins',
    citation:
      'Saw, Main & Gastin (2016). Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures. BJSM 50(5):281-291.',
    doi: '10.1136/bjsports-2015-094758',
  },
  deload: {
    id: 'deload',
    citation:
      'Coleman et al. (2024). Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. PeerJ 12:e16777.',
    doi: '10.7717/peerj.16777',
  },
  rest: {
    id: 'rest',
    citation:
      'Singer et al. (2024). Give it a rest: a systematic review with Bayesian meta-analysis on inter-set rest interval duration and muscle hypertrophy. Front Sports Act Living 6:1429789.',
    doi: '10.3389/fspor.2024.1429789',
  },
};
