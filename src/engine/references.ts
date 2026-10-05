// Every reference was checked on 2026-10-01 against its PubMed record (authors, year, journal, DOI)
// and its abstract (findings below). Re-check before adding a new one; never cite from memory.

export type Reference = {
  id: string;
  citation: string;
  doi: string;
  pmid: string;
  type: string; // meta-analysis, systematic review, RCT, ...
  population: string;
  finding: string; // what the abstract reports, in plain words
};

const r = (x: Reference) => x;

export const REFERENCES: Record<string, Reference> = {
  volume_dose: r({
    id: 'volume_dose', pmid: '27433992', doi: '10.1080/02640414.2016.1210197', type: 'Systematic review and meta-analysis',
    citation: 'Schoenfeld, Ogborn & Krieger (2017). Dose-response relationship between weekly resistance training volume and increases in muscle mass. J Sports Sci 35(11):1073-1082.',
    population: '15 studies, 34 treatment groups',
    finding: 'More weekly sets produced more muscle growth (each extra set about +0.37% gain). Comparing <5, 5-9 and 10+ sets per muscle was only a trend, so no proven optimal number.',
  }),
  frequency_meta: r({
    id: 'frequency_meta', pmid: '30558493', doi: '10.1080/02640414.2018.1555906', type: 'Systematic review and meta-analysis',
    citation: 'Schoenfeld, Grgic & Krieger (2019). How many times per week should a muscle be trained to maximize muscle hypertrophy? J Sports Sci 37(11):1286-1295.',
    population: '25 studies, including trained lifters',
    finding: 'With weekly volume equal, training frequency made no meaningful difference to growth. Pick a frequency that suits you.',
  }),
  frequency_3v6: r({
    id: 'frequency_3v6', pmid: '30363041', doi: '10.1519/JSC.0000000000002909', type: 'Randomized trial',
    citation: 'Saric et al. (2019). Resistance training frequencies of 3 and 6 times per week produce similar muscular adaptations in resistance-trained men. JSCR 33(Suppl 1):S122-S129.',
    population: 'Resistance-trained men, 6 weeks',
    finding: 'Same weekly volume over 3 or 6 sessions gave similar strength and muscle gains.',
  }),
  frequency_2v3: r({
    id: 'frequency_2v3', pmid: '31531139', doi: '10.2478/hukin-2019-0062', type: 'Randomized trial',
    citation: 'Lasevicius et al. (2019). Similar muscular adaptations in resistance training performed two versus three days per week. J Hum Kinet 68:135-143.',
    population: '28 trained men completed, 10 weeks',
    finding: 'Training 2 or 3 days a week gave similar strength and muscle gains.',
  }),
  load_meta: r({
    id: 'load_meta', pmid: '28834797', doi: '10.1519/JSC.0000000000002200', type: 'Systematic review and meta-analysis',
    citation: 'Schoenfeld, Grgic, Ogborn & Krieger (2017). Strength and hypertrophy adaptations between low- vs. high-load resistance training. JSCR 31(12):3508-3523.',
    population: '21 studies, sets taken to failure',
    finding: 'Muscle growth was similar with light and heavy loads; heavy loads built more 1-rep-max strength.',
  }),
  failure: r({
    id: 'failure', pmid: '33497853', doi: '10.1016/j.jshs.2021.01.007', type: 'Systematic review and meta-analysis',
    citation: 'Grgic, Schoenfeld, Orazem & Sabol (2022). Effects of resistance training performed to repetition failure or non-failure on muscular strength and hypertrophy. J Sport Health Sci 11(2):202-211.',
    population: '15 studies, healthy adults',
    finding: 'Training to failure was not required for strength or size gains. In trained lifters, failure showed a small extra benefit for size.',
  }),
  rir_accuracy: r({
    id: 'rir_accuracy', pmid: '34542869', doi: '10.1007/s40279-021-01559-x', type: 'Scoping review with exploratory meta-analysis',
    citation: 'Halperin et al. (2022). Accuracy in predicting repetitions to task failure in resistance exercise. Sports Med 52(2):377-390.',
    population: 'Studies across training levels',
    finding: 'People are imperfect at guessing reps left. Guesses get more accurate closer to failure, with heavier loads, and in later sets.',
  }),
  rir_bench: r({
    id: 'rir_bench', pmid: '37967832', doi: '10.1519/JSC.0000000000004653', type: 'Experimental study',
    citation: 'Refalo et al. (2024). Accuracy of intraset repetitions-in-reserve predictions during the bench press exercise in resistance-trained male and female subjects. JSCR 38(3):e78-e85.',
    population: 'Resistance-trained men and women, bench press',
    finding: 'Predictions of 1 and 3 reps in reserve were off by about 0.65 reps on average, with a slight tendency to underpredict.',
  }),
  rir_autoreg: r({
    id: 'rir_autoreg', pmid: '31009432', doi: '10.1519/JSC.0000000000003164', type: 'Experimental study',
    citation: 'Graham & Cleather (2021). Autoregulation by "repetitions in reserve" leads to greater improvements in strength over a 12-week training program than fixed loading. JSCR 35(9):2451-2456.',
    population: 'Squat training, 12 weeks',
    finding: 'Adjusting load by reps in reserve improved strength more than fixed loading.',
  }),
  progression: r({
    id: 'progression', pmid: '36199287', doi: '10.7717/peerj.14142', type: 'Randomized trial',
    citation: 'Plotkin et al. (2022). Progressive overload without progressing load? The effects of load or repetition progression on muscular adaptations. PeerJ 10:e14142.',
    population: 'Trained men and women, lower body, 8 weeks',
    finding: 'Adding reps or adding load both worked; growth was similar, strength slightly favored adding load.',
  }),
  rest: r({
    id: 'rest', pmid: '39205815', doi: '10.3389/fspor.2024.1429789', type: 'Systematic review with Bayesian meta-analysis',
    citation: 'Singer et al. (2024). Give it a rest: a systematic review with Bayesian meta-analysis on the effect of inter-set rest interval duration on muscle hypertrophy. Front Sports Act Living 6:1429789.',
    population: 'Rest-interval studies',
    finding: 'A small growth benefit to resting more than 60 s; little difference beyond 90 s.',
  }),
  rest_long: r({
    id: 'rest_long', pmid: '26605807', doi: '10.1519/JSC.0000000000001272', type: 'Randomized trial',
    citation: 'Schoenfeld et al. (2016). Longer interset rest periods enhance muscle strength and hypertrophy in resistance-trained men. JSCR 30(7):1805-1812.',
    population: 'Young trained men, 8 weeks',
    finding: '3-minute rests beat 1-minute rests for squat and bench strength and thigh muscle growth.',
  }),
  rest_review: r({
    id: 'rest_review', pmid: '28641044', doi: '10.1080/17461391.2017.1340524', type: 'Systematic review',
    citation: 'Grgic et al. (2017). The effects of short versus long inter-set rest intervals in resistance training on measures of muscle hypertrophy. Eur J Sport Sci 17(8):983-993.',
    population: 'Rest-interval studies',
    finding: 'Short and long rests can both build muscle; newer studies in trained lifters suggest longer rests may help.',
  }),
  deload: r({
    id: 'deload', pmid: '38274324', doi: '10.7717/peerj.16777', type: 'Randomized trial',
    citation: 'Coleman et al. (2024). Gaining more from doing less? The effects of a one-week deload period during supervised resistance training on muscular adaptations. PeerJ 12:e16777.',
    population: '39 trained men and women, 9 weeks',
    finding: 'A week completely off at mid-program did not change muscle growth but led to smaller lower-body strength gains.',
  }),
  checkins: r({
    id: 'checkins', pmid: '26423706', doi: '10.1136/bjsports-2015-094758', type: 'Systematic review',
    citation: 'Saw, Main & Gastin (2016). Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures. BJSM 50(5):281-291.',
    population: '56 studies of athletes (not gym lifters specifically)',
    finding: 'Self-reported well-being tracked training load more sensitively and consistently than objective measures.',
  }),
  autoreg_review: r({
    id: 'autoreg_review', pmid: '32813181', doi: '10.1007/s40279-020-01330-8', type: 'Review',
    citation: 'Greig et al. (2020). Autoregulation in resistance training: addressing the inconsistencies. Sports Med 50(11):1873-1887.',
    population: 'Narrative review',
    finding: 'Autoregulation research uses inconsistent definitions of readiness and fatigue; there is no settled way to turn readiness into training changes.',
  }),
  warmup: r({
    id: 'warmup', pmid: '39593476', doi: '10.1016/j.jbmt.2024.08.004', type: 'Experimental study',
    citation: 'Viveiros et al. (2024). High-load and low-volume warm-up increases performance in a resistance training session. J Bodyw Mov Ther 40:1487-1491.',
    population: '15 trained men',
    finding: 'A warm-up at 80% of the working load led to more total training volume than warm-ups at 40% or 60%.',
  }),
  rom: r({
    id: 'rom', pmid: '36662126', doi: '10.1519/JSC.0000000000004415', type: 'Systematic review',
    citation: 'Kassiano et al. (2023). Which ROMs lead to Rome? A systematic review of the effects of range of motion on muscle hypertrophy. JSCR 37(5):1135-1144.',
    population: '11 studies',
    finding: 'Full range of motion, or partials at long muscle lengths, tended to grow several muscles more than partials at short lengths. Effects differed by muscle.',
  }),
  long_length: r({
    id: 'long_length', pmid: '41646176', doi: '10.1016/j.smhs.2025.03.001', type: 'Systematic review',
    citation: 'Wolf et al. (2026). Does longer-muscle length resistance training cause greater longitudinal growth in humans? Sports Med Health Sci 8(1):34-42.',
    population: '8 studies, 120 participants',
    finding: 'Training at long muscle lengths may grow muscle more, but the evidence is mixed and measurement methods are questionable.',
  }),
  protein: r({
    id: 'protein', pmid: '28698222', doi: '10.1136/bjsports-2017-097608', type: 'Systematic review, meta-analysis and meta-regression',
    citation: 'Morton et al. (2018). A systematic review, meta-analysis and meta-regression of the effect of protein supplementation on resistance training-induced gains in muscle mass and strength in healthy adults. BJSM 52(6):376-384.',
    population: '49 trials, 1,863 participants',
    finding: 'Extra protein increased strength and muscle gains; above about 1.6 g per kg per day there was no further gain in lean mass.',
  }),
  protein_distribution: r({
    id: 'protein_distribution', pmid: '23459753', doi: '10.1113/jphysiol.2012.244897', type: 'Randomized trial (short-term)',
    citation: 'Areta et al. (2013). Timing and distribution of protein ingestion during prolonged recovery from resistance exercise alters myofibrillar protein synthesis. J Physiol 591(9):2319-2331.',
    population: 'Trained men, 12 hours after a workout',
    finding: '20 g of protein every 3 hours raised muscle protein synthesis more than 10 g every 1.5 hours or 40 g every 6 hours. A short-term marker, not long-term growth.',
  }),
  mifflin: r({
    id: 'mifflin', pmid: '2305711', doi: '10.1093/ajcn/51.2.241', type: 'Equation development study',
    citation: 'Mifflin et al. (1990). A new predictive equation for resting energy expenditure in healthy individuals. Am J Clin Nutr 51(2):241-247.',
    population: '498 healthy adults aged 19-78',
    finding: 'The equation explained about 71% of differences in measured resting energy; individual estimates can still be off.',
  }),
  surplus: r({
    id: 'surplus', pmid: '31482093', doi: '10.3389/fnut.2019.00131', type: 'Review',
    citation: 'Slater, Dieter, Marsh & Helms (2019). Is an energy surplus required to maximize skeletal muscle hypertrophy associated with resistance training? Front Nutr 6:131.',
    population: 'Narrative review',
    finding: 'The surplus size that best supports muscle gain is unknown; common recommendations have not been validated.',
  }),
  // Added 2026-10-04 for the caution topics (checked against PubMed records and abstracts).
  lp_wolf: r({
    id: 'lp_wolf', pmid: '39959841', doi: '10.7717/peerj.18904', type: 'Randomized trial (within-person)',
    citation: 'Wolf et al. (2025). Lengthened partial repetitions elicit similar muscular adaptations as full range of motion repetitions during resistance training in trained individuals. PeerJ 13:e18904.',
    population: 'Trained adults, upper body, 8 weeks',
    finding: 'Lengthened partials and full range of motion gave similar arm muscle growth and strength-endurance.',
  }),
  lp_multisite: r({
    id: 'lp_multisite', pmid: '41055237', doi: '10.1080/02640414.2025.2567805', type: 'Multi-site randomized trial (pre-registered)',
    citation: 'Gschneidner et al. (2025). The effects of lengthened-partial range of motion resistance training of the limbs on arm and thigh muscle area: a multi-site randomised trial. J Sports Sci 43(23):2963-2976.',
    population: '297 participants at 15 sites, 12 weeks',
    finding: 'Arm and thigh muscle growth were practically the same with lengthened partials and full range of motion.',
  }),
  damage: r({
    id: 'damage', pmid: '29282529', doi: '10.1007/s00421-017-3792-9', type: 'Review',
    citation: 'Damas, Libardi & Ugrinowitsch (2018). The development of skeletal muscle hypertrophy through resistance training: the role of muscle damage and muscle protein synthesis. Eur J Appl Physiol 118(3):485-500.',
    population: 'Review of training studies',
    finding: 'Muscle damage does not drive muscle growth; programs causing little damage built similar muscle and strength.',
  }),
  creatine: r({
    id: 'creatine', pmid: '35986981', doi: '10.1016/j.nut.2022.111791', type: 'Systematic review and meta-analysis of randomized trials',
    citation: 'Delpino et al. (2022). Influence of age, sex, and type of exercise on the efficacy of creatine supplementation on lean body mass: a systematic review and meta-analysis of randomized clinical trials. Nutrition 103-104:111791.',
    population: '35 trials, 1,192 participants',
    finding: 'Creatine with resistance training added about 1.1 kg of lean mass versus placebo; no clear effect without training.',
  }),
  caffeine: r({
    id: 'caffeine', pmid: '30926628', doi: '10.1136/bjsports-2018-100278', type: 'Umbrella review of 21 meta-analyses',
    citation: 'Grgic et al. (2020). Wake up and smell the coffee: caffeine supplementation and exercise performance, an umbrella review of 21 published meta-analyses. BJSM 54(11):681-688.',
    population: '21 meta-analyses, mostly young men',
    finding: 'Caffeine improved muscle strength, muscle endurance and power, with moderate-quality evidence.',
  }),
};
