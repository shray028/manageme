// Generated from the personalized roadmap reviewed on 16 September 2026.
export type RoadmapDay = { day: number; coding: string; lab: string; minutes: number; problemUrl?: string };
export type RoadmapWeek = { number: number; title: string; outcome: string; days: RoadmapDay[] };
export const roadmapWeeks: RoadmapWeek[] = [
  {
    "number": 1,
    "title": "Get your Python hands back",
    "outcome": "a command-line processor for text records that you can write and debug yourself. Begin the sentiment-service rebuild in a new folder; consult your earlier generated project only after your own attempt.",
    "days": [
      {
        "day": 1,
        "coding": "Baseline: count words, deduplicate records, sort top results",
        "lab": "Create an isolated practice folder and environment. Read ten JSON text records with id, source, text and a toy label; validate them and report the five most common words. Record where you needed help.",
        "minutes": 90
      },
      {
        "day": 2,
        "coding": "Contains Duplicate; sets and membership",
        "lab": "Deduplicate records by ID. Specify what happens if an ID appears with different text; preserve deterministic output order.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/contains-duplicate/"
      },
      {
        "day": 3,
        "coding": "Valid Anagram; dictionaries and counters",
        "lab": "Count records by source/label and filter them. Practice get, items, comprehensions, enumerate, zip and sorting keys.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/valid-anagram/"
      },
      {
        "day": 4,
        "coding": "Two Sum; explain time/space complexity",
        "lab": "Move logic into functions and modules. Reproduce mutable-default, aliasing, is/== and shallow-copy bugs, then fix them.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/two-sum/"
      },
      {
        "day": 5,
        "coding": "Best Time to Buy and Sell Stock",
        "lab": "Add JSON/file handling, narrow exceptions and context managers. Make malformed input produce a useful error.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/best-time-to-buy-and-sell-stock/"
      },
      {
        "day": 6,
        "coding": "45-min blank-file text-processing challenge",
        "lab": "Integrate the processor; write at least six meaningful pytest cases for duplicate IDs, missing fields, empty input, tied counts, blank text and malformed input.",
        "minutes": 240
      },
      {
        "day": 7,
        "coding": "Re-solve two mistakes",
        "lab": "Explain each function and its complexity. Recreate the deduplication-and-counting function without notes.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 2,
    "title": "Write maintainable Python and verify résumé claims",
    "outcome": "typed modules and reusable tests, plus one small implementation tied to your ARXML experience. This is a toy drill with synthetic XML, not a reconstruction of employer data.",
    "days": [
      {
        "day": 8,
        "coding": "Binary Search",
        "lab": "Define a TextRecord dataclass. Practice type hints and None handling; distinguish static hints from runtime validation.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/binary-search/"
      },
      {
        "day": 9,
        "coding": "Valid Palindrome",
        "lab": "Implement a JSONL iterator with yield. Show that it processes one record at a time; explain generator exhaustion and any state retained for deduplication.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/valid-palindrome/"
      },
      {
        "day": 10,
        "coding": "Move Zeroes",
        "lab": "Define a small repository/scorer interface and an in-memory implementation. Practice composition and instance versus class attributes.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/move-zeroes/"
      },
      {
        "day": 11,
        "coding": "Merge Sorted Array",
        "lab": "Write a timing decorator with functools.wraps; explain closure capture and *args/kwargs. Keep it separate from retry logic.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/merge-sorted-array/"
      },
      {
        "day": 12,
        "coding": "Re-solve a Week 1 failure",
        "lab": "ARXML claim drill: on a tiny synthetic XML tree, find an element by ID, modify one value and test that unrelated attributes/elements survive. Explain structural preservation versus byte-for-byte preservation.",
        "minutes": 90
      },
      {
        "day": 13,
        "coding": "45-min language checkpoint",
        "lab": "Build a small cache with an injectable clock: get/set, expiry and missing-key behavior. Use fixtures and parametrized boundary tests; document its single-process scope.",
        "minutes": 240
      },
      {
        "day": 14,
        "coding": "Gate A replaces the normal review split",
        "lab": "Gate A: 45 min for two easy problems; 15 min to rebuild the cache core; 15 min to explain mutability, generators, exceptions and types; 15 min planning.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 3,
    "title": "Rebuild your sentiment FastAPI service",
    "outcome": "implement the health, readiness and batch-inference behavior already named in your résumé, initially using a deterministic rule scorer.",
    "days": [
      {
        "day": 15,
        "coding": "Valid Parentheses",
        "lab": "Implement /health and /ready. Define the difference between a live process and a service able to score requests. Start with an explicitly identified rule scorer.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/valid-parentheses/"
      },
      {
        "day": 16,
        "coding": "Group Anagrams",
        "lab": "Add POST /predict/batch with Pydantic request/response models. Bound batch size and text length; define behavior for blank text, malformed bodies and duplicate IDs within a batch.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/group-anagrams/"
      },
      {
        "day": 17,
        "coding": "Top K Frequent Elements",
        "lab": "Return one result per input in stable order, including label, active scorer kind and version. Test singleton and multi-record batches. Do not label a rule score as a calibrated probability.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/top-k-frequent-elements/"
      },
      {
        "day": 18,
        "coding": "Longest Substring Without Repeating Characters",
        "lab": "Separate routes, scoring and storage. Inject the scorer/repository and override them in tests; explain why a successful mock does not prove the real inference path.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/longest-substring-without-repeating-characters/"
      },
      {
        "day": 19,
        "coding": "Re-solve a dictionary/window problem",
        "lab": "Store prediction history in memory and implement bounded, deterministic pagination for GET /predictions. Test empty history, invalid limits and timestamp ties.",
        "minutes": 90
      },
      {
        "day": 20,
        "coding": "45-min endpoint implementation drill",
        "lab": "Integrate the service; cover success, validation failure, missing data and scorer failure. Rebuild one endpoint from a blank file without the old project or a tutorial.",
        "minutes": 240
      },
      {
        "day": 21,
        "coding": "Two re-solves + 30-min API walkthrough",
        "lab": "Demonstrate actual HTTP requests and tests. Trace one request through validation, scoring, response and history; identify framework-provided versus personally implemented behavior.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 4,
    "title": "Persistence, SQL and concurrency",
    "outcome": "durable prediction history, atomic batch writes and a separate async exercise. Do not retrofit async everywhere at once.",
    "days": [
      {
        "day": 22,
        "coding": "Reverse Linked List",
        "lab": "Replace in-memory history with SQLite using the texts, requests and predictions schema below. Write key constraints and parameterized insert/select operations.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/reverse-linked-list/"
      },
      {
        "day": 23,
        "coding": "Merge Two Sorted Lists",
        "lab": "Practice joins, grouping and WHERE versus HAVING using the prediction history. Keep SQL Tasks 1–6 as small queries over the same seeded database.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/merge-two-sorted-lists/"
      },
      {
        "day": 24,
        "coding": "Linked List Cycle",
        "lab": "Persist a request and all its predictions in one transaction. Use a unique request ID plus payload hash for repeat delivery; return the recorded result for the same payload and reject a conflicting reuse. Inject a failure and test rollback.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/linked-list-cycle/"
      },
      {
        "day": 25,
        "coding": "Remove Nth Node From End of List",
        "lab": "Add an index for an actual history filter/order query and inspect its plan. Explain read benefit versus write/storage cost.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/remove-nth-node-from-end-of-list/"
      },
      {
        "day": 26,
        "coding": "Re-solve a linked-list failure",
        "lab": "In a separate lab, fetch simulated text metadata concurrently with asyncio; compare sequential and concurrent elapsed time.",
        "minutes": 90
      },
      {
        "day": 27,
        "coding": "45-min SQL/concurrency drill",
        "lab": "Add bounded concurrency, timeouts and explicit failure behavior to the lab. Inject a slow/failing call and test cleanup. Finish the eight SQL tasks during the remaining build time.",
        "minutes": 240
      },
      {
        "day": 28,
        "coding": "Gate B replaces all normal review/re-solve work",
        "lab": "Gate B: 75 min to add GET /requests/{id} with persistence and three useful tests; 15 min to explain one query plan and the async lab. Total: 90 min.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 5,
    "title": "Reliability, retrieval evaluation and system design",
    "outcome": "demonstrate failure handling in your rebuilt service and independently reproduce the mechanics behind a retrieval metric on your résumé.",
    "days": [
      {
        "day": 29,
        "coding": "Maximum Depth of Binary Tree",
        "lab": "Graph claim drill: represent a tiny inheritance/containment graph with an adjacency map; traverse it with a visited set and test a cycle/missing node. Use the reading slot to compare CPU work, I/O waits, threads and processes.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/maximum-depth-of-binary-tree/"
      },
      {
        "day": 30,
        "coding": "Binary Tree Level Order Traversal",
        "lab": "Add a bounded in-process scoring cache. Include input identity, preprocessing and active scorer version in its key; test expiry and a stale-result bug after a version change.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/binary-tree-level-order-traversal/"
      },
      {
        "day": 31,
        "coding": "Number of Islands",
        "lab": "Implement retries in a standalone simulated client: retry only transient, safe operations, with a deadline, jitter and capped backoff.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/number-of-islands/"
      },
      {
        "day": 32,
        "coding": "Kth Largest Element in an Array",
        "lab": "Time/profile text preprocessing; add attempt correlation IDs and structured error logs. Keep a retry's logical request identity separate from its attempt identity. Write a small JSON measurement record.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/kth-largest-element-in-an-array/"
      },
      {
        "day": 33,
        "coding": "Re-solve a graph or heap problem",
        "lab": "RAG claim drill: implement Hit@5 on five synthetic queries with known relevant-document sets. Test hits, misses and duplicate retrieved IDs; explain why Hit@5 is not answer faithfulness or context precision.",
        "minutes": 90
      },
      {
        "day": 34,
        "coding": "45-min staged implementation drill",
        "lab": "Implement TinyURL in stages: create/lookup → duplicates → expiry. Use the remaining integration time to inject a timeout/scorer failure into the sentiment service and harden its tests.",
        "minutes": 240
      },
      {
        "day": 35,
        "coding": "Two re-solves + 30-min design drill",
        "lab": "Design notification delivery. Discuss retries, idempotency, queues, dead letters, ordering and backpressure; connect those concepts to repeated prediction requests.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 6,
    "title": "Train and serve one tiny PyTorch text classifier",
    "outcome": "rebuild a genuine training-to-serving path that you can explain, with a deliberately small synthetic sentiment task. This is engineering practice, not evidence of real sentiment quality.",
    "days": [
      {
        "day": 36,
        "coding": "Merge Intervals",
        "lab": "Create a tiny labelled synthetic-text dataset with a documented label rule. Split records before fitting a vocabulary; keep duplicate/closely related variants together. Implement a bounded bag-of-words encoder fitted on training text only.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/merge-intervals/"
      },
      {
        "day": 37,
        "coding": "3Sum",
        "lab": "Train one CPU-sized PyTorch linear binary classifier over those vectors. Explain tensor shapes, logits, loss and optimization; define handling for unknown words. No Transformer or LSTM is required.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/3sum/"
      },
      {
        "day": 38,
        "coding": "Subsets",
        "lab": "Save state_dict, vocabulary order, label mapping, preprocessing settings, split/seed and artifact version. Reload and compare predictions on fixed inputs within a stated tolerance.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/subsets/"
      },
      {
        "day": 39,
        "coding": "Climbing Stairs",
        "lab": "Implement the existing scorer interface with the model; load once per worker during startup. Use eval() and inference mode; explain their different purposes and test application lifespan.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/climbing-stairs/"
      },
      {
        "day": 40,
        "coding": "Re-solve a Week 3 or Week 5 failure",
        "lab": "Test empty/invalid batches, all-unknown text and missing/corrupt artifacts. If a rule fallback is enabled, identify its actual kind/version in responses and log why it was used; without an allowed scorer, readiness/inference must fail deliberately.",
        "minutes": 90
      },
      {
        "day": 41,
        "coding": "45-min ML-service debugging drill",
        "lab": "Complete integration. Save JSON metrics containing sample count, split ID, confusion counts, accuracy, F1 and log-loss, with denominator edge cases handled. Measure warm model batches of 1 and 16 on fixed inputs; distinguish batch latency from per-item latency.",
        "minutes": 240
      },
      {
        "day": 42,
        "coding": "Two re-solves + 30-min ML walkthrough",
        "lab": "Gate C: demonstrate train → save → load → predict; show a fixed-input comparison, one failure/fallback and your metrics file. Explain vocabulary leakage, versioning and why synthetic results do not support a production accuracy claim.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 7,
    "title": "Data quality, containers and deployment decisions",
    "outcome": "a repeatable local pipeline and a service someone else can run; convert the course's deployment and quality topics into observable behavior.",
    "days": [
      {
        "day": 43,
        "coding": "Invert Binary Tree",
        "lab": "Build a small pipeline: read labelled JSONL → validate → deduplicate → write a versioned dataset and a data-quality JSON report. Record input identity and rejected-row counts.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/invert-binary-tree/"
      },
      {
        "day": 44,
        "coding": "Permutations",
        "lab": "Test reruns, malformed rows, missing values and overlapping train/validation IDs. Explain which checks test data quality, model quality, pipeline behavior and system behavior.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/permutations/"
      },
      {
        "day": 45,
        "coding": "Course Schedule",
        "lab": "Write a Dockerfile and run the service locally. In the reading slot, map source/label aggregation to Spark select/filter/groupBy on paper; use that slot for model repair if needed.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/course-schedule/"
      },
      {
        "day": 46,
        "coding": "House Robber",
        "lab": "Write a small GitLab CI definition for tests/build and run its commands locally. Discuss a separate model-quality promotion gate and readiness/liveness/startup probes. If Gate C is incomplete, replace this lab with model repair.",
        "minutes": 90,
        "problemUrl": "https://leetcode.com/problems/house-robber/"
      },
      {
        "day": 47,
        "coding": "Re-solve a backtracking or graph failure",
        "lab": "Draw training and online inference separately. Write a short model card covering synthetic data, features, version, measurements, intended learning use and limitations; describe rollback.",
        "minutes": 90
      },
      {
        "day": 48,
        "coding": "45-min incident drill",
        "lab": "Run a repeatable local load test and collect p50/p95, throughput and errors. Explain a bottleneck and test one change. Finish container/run instructions; prioritize missing core model work over extra optimization.",
        "minutes": 240
      },
      {
        "day": 49,
        "coding": "Two re-solves + 30-min design drill",
        "lab": "eBay transfer exercise: explain how these API/data/failure principles apply to catalog recommendations: candidate retrieval → ranking → filtering → fallback, with stale inventory and cold start. Draw it; do not build a second application.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 8,
    "title": "Interview execution and repair",
    "outcome": "tested readiness and a clear explanation of your actual work. Stop adding stack components.",
    "days": [
      {
        "day": 50,
        "coding": "Python mock: 45 min",
        "lab": "Implement a JSONL aggregation utility or TTL cache from a fresh file. Use the remaining time to review correctness, tests and language gaps.",
        "minutes": 90
      },
      {
        "day": 51,
        "coding": "DSA mock: 45 min",
        "lab": "One unseen medium from a practiced pattern. Clarify, explain brute force, improve it, code, test and give complexity. Review without rewriting history.",
        "minutes": 90
      },
      {
        "day": 52,
        "coding": "Machine-coding mock: 60 min",
        "lab": "Add a prediction-history filter, then extend it with scorer-version filtering. Tests must keep passing. Use 30 min to review structure and edge cases.",
        "minutes": 90
      },
      {
        "day": 53,
        "coding": "System design mock: 45 min",
        "lab": "Design notification delivery or an ML inference service; defend consistency, capacity assumptions, failures and observability. Repair the weakest area.",
        "minutes": 90
      },
      {
        "day": 54,
        "coding": "Project/behavior mock: 45 min",
        "lab": "Give a 5-minute architecture walkthrough and answer ownership/tradeoff follow-ups. Practice six real work stories; distinguish your capstone from employment experience.",
        "minutes": 90
      },
      {
        "day": 55,
        "coding": "Final 4-hour block",
        "lab": "Gate D: 45-min unseen coding task + 60-min implementation + 45-min design + 30-min project/behavior + 30-min review + 30-min buffer/break.",
        "minutes": 240
      },
      {
        "day": 56,
        "coding": "90-min repair and next steps",
        "lab": "Re-test the weakest category, write honest résumé bullets from measured work and select applications aligned with your demonstrated level.",
        "minutes": 90
      }
    ]
  },
  {
    "number": 9,
    "title": "Consolidate and apply",
    "outcome": "Four one-hour sessions to close gaps and prepare applications.",
    "days": [
      {
        "day": 57,
        "coding": "Rebuild your weakest implementation from a blank file. If model work remains, use this hour for it instead and keep the model milestone incomplete until it passes.",
        "lab": "",
        "minutes": 60
      },
      {
        "day": 58,
        "coding": "Repeat the weakest mock with a different input/problem. Record whether the same mistake returns.",
        "lab": "",
        "minutes": 60
      },
      {
        "day": 59,
        "coding": "Tailor your résumé and prepare a five-minute project demo. Verify the actual vacancy and ask the recruiter about language choice, coding format and design/ML emphasis.",
        "lab": "",
        "minutes": 60
      },
      {
        "day": 60,
        "coding": "Rehearse your introduction and six work stories, review the mistake log and stop cramming new topics.",
        "lab": "",
        "minutes": 60
      }
    ]
  }
];
