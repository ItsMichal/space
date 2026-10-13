# Papers that acknowledge or credit him (not as an author)

Data: `content/mentions.ts` (`paperMentions`). Research date 2026-10-13. Facts only; every quote was read in a full text
that was fetched and text-extracted, and the confirmed hit was cross-checked against Google Scholar's snippet of the
published version.

## Result in one line

1 confirmed mention. 187 distinct papers were swept: 1 named in the text, 4 name him only in a reference list (as a
co-author of the cited CHI 2025 or JIA paper), 138 open full texts do not name him, 44 could not be read (paywalled
or blocked). Strong enough to show publicly: the one confirmed entry (an explicit thank-you naming him and what he built).

## Confirmed

| Paper | Where | Quote (short) | Full text |
|---|---|---|---|
| Hirshfield, Wickens, Doherty, Spencer, Williams, Hayne. "Toward Workload-Based Adaptive Automation: The Utility of fNIRS for Measuring Load in Multiple Resources in the Brain." IJHCI 40(22), 7404-7430, online 2023-10-23. doi:10.1080/10447318.2023.2266242 | Acknowledgements, PDF page 40 of 63 (accepted manuscript) | "We'd also like to thank Michal Bodzianowski for his phenomenal support creating and maintaining the search and sort testbed used in our studies." | https://par.nsf.gov/servlets/purl/10473499 (NSF PAR); record https://par.nsf.gov/biblio/10473499 |

Identity: the paper is from his SHINE Lab (PI Leanne Hirshfield; co-author Emily Doherty is on the CHI 2025 paper with
him); his SHINE staff profile says he worked on lab testbeds; the full name matches. Not tied to a post (no post covers
the search-and-sort testbed); `relatedPostId` is left unset.

Why only one is shown: the owner's phrase "mentioned in the paper" is satisfied by an acknowledgment or credit in the
body text. Reference-list appearances come from him being a co-author of the cited paper, which the site already
shows under Publications, so they are not mentions.

## Method

Sources used, all public and unauthenticated, one request every 2 to 12 seconds:
1. OpenAlex full-text search (`filter=fulltext.search`) for "Bodzianowski", "Michal Bodzianowski", "Michał Bodzianowski",
   "Bodzianowski software engineer", "Bodzianowski acknowledgments": 45 / 6 / 8 / 2 / 1 hits. Nearly all are a
   Polish artist with the same surname; the relevant ones are papers that cite his CHI 2025 paper in their reference
   lists, plus his own ApJ paper. OpenAlex only indexes full text for part of the literature, so this is not conclusive.
2. NSF Public Access Repository (par.nsf.gov), which hosts accepted manuscripts of NSF-funded work: every record under
   iSAT award 2019805 (102), the new iSAT award 2454151 (14), SHINE award 1909864 (16) and the author search
   "Hirshfield" (29). About 150 distinct records after de-duplication; every full text that exists was downloaded and
   searched (records whose manuscript file was not yet available are listed as no-access).
3. OpenAlex author works for Leanne Hirshfield (2020 to 2026, 57 works) with open PDFs from publishers and
   repositories (arXiv, Frontiers, Nature, MDPI, ISLS, AAAI, Colorado's CU Scholar), plus manually added iSAT/CoBi/AAAI papers.
4. Google Scholar full-text snippets for about 20 query variants ("Bodzianowski" with thank, acknowledgments, testbed,
   fNIRS, trust, dashboard, solar flare, "for his", software engineer, and name spellings). No CAPTCHA was hit.
   Only the confirmed paper surfaced with a thank-you sentence.
5. Europe PMC full-text search ("Bodzianowski"): 0 hits. CU Scholar (scholar.colorado.edu) search: no results for the
   surname; its full text is not searchable.
6. PDFs were text-extracted with pypdf; the search normalises whitespace, hyphens and soft hyphens so a name split
   across lines ("Bodzia-nowski") still matches. Hits were read in context and classified as in-text or reference-list.

Not done, by rule: no login-walled sites, no paywall circumvention. ACM Digital Library PDFs returned HTTP 403 to
scripts (Cloudflare), so ACM-only papers are listed below as candidates for manual checking. Springer, T&F, Wiley, Sage
and Elsevier full texts were not accessible. ResearchGate, ProQuest and Google Books were not scraped.

## Near-misses: related work on systems he built (do NOT name him)

Open full text read and searched; he is not named. Useful context only.
- Dey, Dickler, Hirshfield, Goss, Tissenbaum, Puntambekar. "Using Participatory Design Studies to Collaboratively Create
  Teacher Dashboards" (AIED 2022 posters, Springer). PAR manuscript, 4 pp, about teacher dashboards. Relates to post `isat-dashboard`.
- Dey et al. "Developing Dynamic Dashboards for Classroom Orchestration" (2022, PAR manuscript, 2 pp). Same topic.
- D'Mello et al. "From learning optimization to learner flourishing: Reimagining AI in Education at the Institute for
  Student-AI Teaming (iSAT)." AI Magazine 45(1), 2024, doi:10.1002/aaai.12158. PAR manuscript; discusses the iSAT
  interactive display 22 times, does not name him.
- Doherty, Spencer, Eloy, Kumar, Dickler, Hirshfield. "Using Speech Patterns to Model the Dimensions of Teamness in
  Human-Agent Teams." ICMI 2023, doi:10.1145/3577190.3614121. PAR manuscript. Uses the Computer-Human Allocation of
  Resources Testbed (CHART) and cites Bobko et al. (TIES 2023) for it. His TrustTeaming repo README is the improved
  testbed for the same Trust Teaming experiment and cites that TIES paper, but no sentence in this paper links the
  two, so treat the connection as probable and unconfirmed.
- Eloy, Doherty, Spencer, Bobko, Hirshfield. "Using fNIRS to Identify Transparency- and Reliability-Sensitive Markers of
  Trust Across Multiple Timescales in Collaborative Human-Human-Agent Triads." Frontiers in Neuroergonomics 2022,
  doi:10.3389/fnrgo.2022.838625. Open full text; uses CHART; does not name him.
- iSAT AI-partner papers read in full that do not name him in the text: "Examining Support Moments With a
  Conversational AI Partner" (CSCL 2025), "Exploring GenAI Technologies within Collaborative Learning" (CSCL 2025; its
  reference list cites the CHI 2025 paper), "Speech Is Not Enough" (AAAI 2025; its reference list cites the submitted
  JIA manuscript with him as co-author), Khebour et al. 2024 multimodal dataset (JOHD).

Papers where he is a co-author but which are not on the site yet (authorship, not mentions): the submitted manuscript
"'JIA Fueled My Ideas': Designing an Interactive AI Partner for Assisting Small Group Collaborations among Students
Aged 12-17" (Zhang, Cao, Dey, Foltz, Palmer, Tissenbaum, Biddy, Doherty, Bodzianowski, Palmer, Hirshfield; listed as
submitted to IJCSCL in the iSAT Summer 2025 newsletter and cited as "manuscript submitted" in the AAAI 2025 paper),
and iSAT conference items listed in the iSAT newsletters (AIED 2022 interactive event; LAK 2023 workshop paper
"The iSAT Collaboration Analytics Pipeline"). Not added; ask the owner whether he wants them listed.

## Paywalled or blocked candidates worth a manual check by the owner

Likely to credit the testbed/platform work, in rough order of likelihood:
1. Bobko, Hirshfield, Eloy, Spencer, Doherty, Driscoll, Obolsky. "Human-agent teaming and trust calibration: a theoretical
   framework, configurable testbed, empirical illustration, and implications for the development of adaptive systems."
   Theoretical Issues in Ergonomics Science 24(3), 310-334, 2023, doi:10.1080/1463922X.2022.2086644. T&F, no open copy found.
   The TrustTeaming repo cites this paper and asks for attribution to him.
2. Eloy, Doherty, Spencer, Hirshfield. "Capturing the Dynamics of Trust and Team Processes in Human-Human-Agent Teams via
   Multidimensional Neural Recurrence Analyses." PACM HCI 7(CSCW1), 2023, doi:10.1145/3579598 (ACM, blocked to scripts).
3. Eloy, Doherty, Spencer, Hirshfield. "Enhancing adaptive human-agent teaming systems with functional near-infrared
   spectroscopy." IJHCI 42(3), 2026, doi:10.1080/10447318.2025.2524490.
4. Perkoff, E. M. Dissertation "Bringing Everyone In: The Future of Collaboration with Conversational AI," 2025 (ProQuest,
   University of Colorado). Acknowledgment sections of dissertations from this lab often name engineers; JIA/CoBi context.
5. Dissertations of other lab members (for example Lucca Eloy, Emily Doherty; CU Boulder, ProQuest). Not located in open repositories.
6. Dey/Hirshfield et al. "HCI Strategies for Informing the Design of a Teacher Dashboard" (Springer 2022,
   doi:10.1007/978-3-031-19682-9_21); Zhang et al. "JIA Fueled My Ideas" once published; Perkoff, Doherty, Bush, Hirshfield
   "Crafting a Responsible Dialog System for Collaborative Learning Environments" (AAAI 2024 workshop); Doherty et al.
   "Learning from Learners" (HEAL @ CHI 2026) and Dutta, Doherty, Hirshfield (CHI EA 2026, doi:10.1145/3772363.3799244).
7. Hirshfield et al. "Future of Team Research: On Teamness and Dimensions of Variability in Teams" (HFES 2024,
   doi:10.1177/10711813241278288; Sage, blocked) and the 2025 HFES cognitive-security papers (low likelihood).
8. iSAT annual reports / NSF project outcome reports: not found in public repositories.

## Unverified

- Whether the "search and sort testbed" thanked in the IJHCI paper is the same system the SHINE staff profile calls a
  lab "testbed (web, desktop)". The profile does not name this testbed; the match is by role, lab and date range.
- 44 papers below are "no-access": the absence of a mention is unknown, not confirmed.

## Appendix: all papers swept (187)

Status: NAMED-IN-TEXT, named-in-reference-list-only (he is a co-author of a cited paper), not-named (open full text
searched), no-access (could not be read). "Source" is the file actually searched.

| Year | Title | Result | Source |
|---|---|---|---|
| 2023 | Toward Workload-Based Adaptive Automation: The Utility of fNIRS for Measuring Load in Multiple  | NAMED-IN-TEXT | par.nsf.gov/servlets/purl/10473499 |
| 2025 | Exploring GenAI Technologies within Collaborative Learning | named-in-reference-list-only | repository.isls.org//bitstream/1/11900/1/CSCL2025_499-506.pd |
| 2025 | Speech Is Not Enough: Interpreting Nonverbal Indicators of Common Knowledge and Engagement | named-in-reference-list-only | ojs.aaai.org/index.php/AAAI/article/download/35364/37519 |
| 2026 | I Felt Bad After We Ignored Her: Interface-Driven Social Prominence (arXiv) | named-in-reference-list-only | arxiv.org/pdf/2602.14407 |
| 2026 | Building Bridges Between Student and Curricular Language: Creating a Corpus of Abstract Meaning | named-in-reference-list-only | aclanthology.org/2026.lrec-1.936.pdf |
| 2020 | Perceived Restorativeness and Meditation Depth for Virtual Reality Supported Mindfulness Interv | no-access |  |
| 2020 | A Neurophysiological Sensor Suite for Real-Time Prediction of Pilot Workload in Operational Set | no-access |  |
| 2021 | Using fNIRS to Examine Neural Mechanisms of Change Associated with Mindfulness-Based Interventi | no-access |  |
| 2021 | Using fNIRS to examine mechanisms of neural changes associated with mindfulness-based intervent | no-access |  |
| 2021 | A Pose Proposal and Refinement Network for Better 6D Object Pose Estimation | no-access |  |
| 2022 | Human-agent teaming and trust calibration: a theoretical framework, configurable testbed, empir | no-access |  |
| 2022 | Estimating Cognitive Load and Cybersickness of Pilots in VR Simulations via Unobtrusive Physiol | no-access |  |
| 2022 | HCI Strategies for Informing the Design of a Teacher Dashboard: How Might Real-Time Situational | no-access |  |
| 2023 | Capturing the Dynamics of Trust and Team Processes in Human-Human-Agent Teams via Multidimensio | no-access |  |
| 2023 | Now Look Here! $$\Downarrow $$ Mixed Reality Improves Robot Communication Without Cognitive Ove | no-access |  |
| 2023 | Towards Ecological Measurement of Complex Cognitive Processes: Functional-Near Infrared Spectro | no-access |  |
| 2023 | The Community Builder (CoBi): Helping Students to Develop Better Small Group Collaborative Lear | no-access |  |
| 2023 | The Future of AI in Education: AI Classroom Partners | no-access |  |
| 2024 | Towards an Eye-Brain-Computer Interface: Combining Gaze with the Stimulus-Preceding Negativity  | no-access |  |
| 2024 | Misinformation research needs ecological validity | no-access |  |
| 2024 | Future of Team Research: On Teamness and Dimensions of Variability in Teams | no-access |  |
| 2024 | Linking trust constructs with computer science-based decision-making systems | no-access |  |
| 2024 | Formal Minimal and Maximal Definitions for Characterizing Mis, Dis, and Malinformation | no-access |  |
| 2025 | Understanding the neurocognitive mechanisms of cognitive security | no-access |  |
| 2025 | Block-Wise Domain Adaptation for Workload Prediction from fNIRS Data | no-access |  |
| 2025 | Techno, Social, Techno-Social: Examining Information Disorder Literature using Deductive Qualti | no-access |  |
| 2025 | Enhancing Adaptive Human-Agent Teaming Systems with Functional Near-Infrared Spectroscopy | no-access |  |
| 2025 | Investigating Cognitive Engagement from Training to Application Under Varied Workload Manipulat | no-access |  |
| 2025 | Investigating the Effects of Hierarchy and Fatigue on Cognitive Security in Isolated, Confined, | no-access |  |
| 2025 | Charting New Frontiers in Cognitive Security: A Human Factors Call to Action | no-access |  |
| 2025 | Beyond Media Literacy: Human Factors-Informed Education to Develop Cognitive Security | no-access |  |
| 2025 | Learning “Partner-Aware” Collaborators in Multi-Party Collaboration | no-access |  |
| 2025 | A Feasibility and Implementation Integrity Study of the Community Builder (CoBi): An AI-based C | no-access |  |
| 2025 | Linguistic Alignment Predicts Learning in Small Group Tutoring Sessions | no-access |  |
| 2025 | Curriculum Routines and a Community Builder AI Agent: Synergy to Mediate the Convergent Team Pr | no-access |  |
| 2026 | Mapping the Spectrum of Automatability: A Framework for LLM-Assisted Annotation of Team Communi | no-access |  |
| 2026 | Evaluating Cognitive Security in an Operationally Relevant Field Environment | no-access |  |
| 2026 | Identifying Team Decision Making Factors in Isolated, Confined, and Extreme Environments | no-access |  |
| 2026 | Bridging fMRI and fNIRS: Challenges in Transfer Learning for Ecologically Valid Cognitive State | no-access |  |
| 2026 | ERP-XTTN: Interpretable Cross-Subject Error-Related Potential Classification via Cross-Attentio | no-access |  |
| 2026 | Frictive Policy Optimization for LLM Agent Interactions - Brandeis University | no-access |  |
| 2026 | Learning from Learners: Human-Centered Evaluation of Conversational Agents in Educational Setti | no-access |  |
| 2026 | Survey of end-to-end multi-speaker automatic speech recognition for monaural audio | no-access |  |
| 2026 | Scaling Teacher Professional Learning Through Automated Feedback: An Evaluation in K-12 Classro | no-access |  |
| 2026 | Improving Speech Recognition of Named Entities in Classroom Speech with LLM Revision and Phonet | no-access |  |
| 2026 | Distributed Partial Information Puzzles: Examining Common Ground Construction Under Epistemic A | no-access |  |
| 2026 | Collaborate, Deliberate, Evaluate: How LLM Alignment Affects Coordinated Multi-Agent Outcomes | no-access |  |
| 2026 | Frictive Policy Optimization for LLM Agent Interactions | no-access |  |
| 2026 | Designing AI partner-embedded learning environments to support AI literacies | no-access |  |
| 2017 | Structure-based, high transformer ratio collinear two-beam accelerator | not-named | par.nsf.gov/servlets/purl/10026232 |
| 2018 | Detuned-Structure-Based Beam-Driven Accelerator | not-named | par.nsf.gov/servlets/purl/10110128 |
| 2019 | Beam Driven Bimodal Cavity Structure for High Gradient Acceleration | not-named | par.nsf.gov/servlets/purl/10178084 |
| 2019 | Ka-Band High Power Harmonic Amplifier for Bunch Phase-Space Linearization | not-named | par.nsf.gov/servlets/purl/10178086 |
| 2019 | 1st +2nd Harmonic Photocathode Bimodal Gun R&D | not-named | par.nsf.gov/servlets/purl/10178101 |
| 2020 | Using Augmented Reality to Better Study Human-Robot Interaction | not-named | par.nsf.gov/servlets/purl/10155297 |
| 2020 | Identification of Potential Task Shedding Events Using Brain Activity Data | not-named | par.nsf.gov/servlets/purl/10169468 |
| 2020 | Simultaneous and Spatiotemporal Detection of Different Levels of Activity in Multidimensional D | not-named | ieeexplore.ieee.org/ielx7/6287639/8948470/09127934.pdf |
| 2020 | Designing Effective Educational Software: Involving Children In The Design Process | not-named | peer.asee.org/1223.pdf |
| 2020 | Exploring Mixed Reality Robot Communication Under Different types of Mental Workload | not-named | par.nsf.gov/servlets/purl/10155101 |
| 2020 | Tradeoffs Between Effectiveness and Social Perception When Using Mixed Reality to Supplement Ge | not-named | par.nsf.gov/servlets/purl/10155102 |
| 2020 | Investigating Confidence-Based Category Transition of Spatial Gestures | not-named | par.nsf.gov/servlets/purl/10172959 |
| 2020 | Exploring social and cognitive dimensions of collaborative problem solving in an open online si | not-named | par.nsf.gov/servlets/purl/10497212 |
| 2021 | Classification of fNIRS Finger Tapping Data With Multi-Labeling and Deep Learning | not-named | par.nsf.gov/servlets/purl/10343887 |
| 2021 | Get This!? Mixed Reality Improves Robot Communication Regardless of Mental Workload | not-named | par.nsf.gov/servlets/purl/10223467 |
| 2021 | Multimodal Engagement Analysis from Facial Videos in the Classroom | not-named | par.nsf.gov/servlets/purl/10349953 |
| 2021 | Integrating Psychometrics and Computing Perspectives on Bias and Fairness in Affective Computin | not-named | par.nsf.gov/servlets/purl/10381211 |
| 2021 | Say What? Automatic Modeling of Collaborative Problem Solving Skills from Student Speech in the | not-named | par.nsf.gov/servlets/purl/10494306 |
| 2021 | The Data Sensor Hub (DaSH): A Physical Computing System to Support Middle School Inquiry Scienc | not-named | par.nsf.gov/servlets/purl/10343522 |
| 2021 | Voice Design to Support Young Children’s Agency in Child-Agent Interaction | not-named | par.nsf.gov/servlets/purl/10494294 |
| 2021 | Challenges and Unexpected Affordances of Physical Computing Going Remote | not-named | par.nsf.gov/servlets/purl/10497412 |
| 2021 | Is it Pointless? Modeling and Evaluation of Category Transitions of Spatial Gestures | not-named | par.nsf.gov/servlets/purl/10248927 |
| 2021 | What's The Point?: Tradeoffs Between Effectiveness and Social Perception When Using Mixed Reali | not-named | par.nsf.gov/servlets/purl/10223466 |
| 2021 | Child-Robot Interaction to Integrate Reflective Storytelling Into Creative Play | not-named | par.nsf.gov/servlets/purl/10494297 |
| 2021 | Embodied Multimodal Agents to Bridge the Understanding Gap | not-named | par.nsf.gov/servlets/purl/10494303 |
| 2021 | Building an Emotionally Responsive Avatar with Dynamic Facial Expressions in Human—Computer Int | not-named | par.nsf.gov/servlets/purl/10494314 |
| 2021 | TEACHING GROUNDED READING SKILLS VIA AN INTERACTIVE ROBOT TUTOR | not-named | par.nsf.gov/servlets/purl/10494243 |
| 2021 | Avoiding Overlap in Data Augmentation for AMR-to-Text Generation | not-named | par.nsf.gov/servlets/purl/10494178 |
| 2021 | What Would a Teacher Do? Predicting Future Talk Moves | not-named | par.nsf.gov/servlets/purl/10494246 |
| 2022 | Using fNIRS to Identify Transparency- and Reliability-Sensitive Markers of Trust Across Multipl | not-named | www.frontiersin.org/articles/10.3389/fnrgo.2022.838625/pdf |
| 2022 | Using Participatory Design Studies to Collaboratively Create Teacher Dashboards | not-named | par.nsf.gov/servlets/purl/10329344 |
| 2022 | Robot-generated Mixed Reality Gestures Improve Human-Robot Interaction | not-named | par.nsf.gov/servlets/purl/10340524 |
| 2022 | Assessing Multimodal Dynamics in Multi-Party Collaborative Interactions with Multi-Level Vector | not-named | par.nsf.gov/servlets/purl/10494293 |
| 2022 | Grounding Meaning Representation for Situated Reasoning | not-named | par.nsf.gov/servlets/purl/10499540 |
| 2022 | Toward Argument‐Based Fairness with an Application to AI‐Enhanced Educational Assessments | not-named | par.nsf.gov/servlets/purl/10381213 |
| 2022 | How to Give Imperfect Automated Guidance to Learners: A Case-Study in Workplace Learning | not-named | par.nsf.gov/servlets/purl/10499546 |
| 2022 | Fine-tuning Transformers with Additional Context to Classify Discursive Moves in Mathematics Cl | not-named | par.nsf.gov/servlets/purl/10499538 |
| 2022 | Developing Dynamic Dashboards for Classroom Orchestration | not-named | par.nsf.gov/servlets/purl/10329326 |
| 2022 | Improving neural machine translation with the Abstract Meaning Representation by combining grap | not-named | par.nsf.gov/servlets/purl/10499543 |
| 2022 | Response Construct Tagging: NLP-Aided Assessment for Engineering Education | not-named | par.nsf.gov/servlets/purl/10499780 |
| 2022 | Engaging Youth in Envisioning Artificial Intelligence in Classrooms: Lessons Learned | not-named | par.nsf.gov/servlets/purl/10499515 |
| 2022 | "It disrupts power dynamics": Co-Design Process as a Space for Intergenerational Learning with  | not-named | par.nsf.gov/servlets/purl/10497791 |
| 2022 | Can the Mathematical Correctness of Object Configurations Affect the Accuracy of Their Percepti | not-named | par.nsf.gov/servlets/purl/10497728 |
| 2022 | The VoxWorld Platform for Multimodal Embodied Agents | not-named | par.nsf.gov/servlets/purl/10497789 |
| 2022 | Open-domain Dialogue Generation: What We Can Do, Cannot Do, And Should Do Next | not-named | par.nsf.gov/servlets/purl/10499778 |
| 2022 | Do Speech-Based Collaboration Analytics Generalize Across Task Contexts? | not-named | par.nsf.gov/servlets/purl/10497792 |
| 2022 | The relationship between collaborative problem solving behaviors and solution outcomes in a gam | not-named | par.nsf.gov/servlets/purl/10341079 |
| 2022 | Personalized Instruction to Teach Secondary Students to Deeply Comprehend and Build Knowledge f | not-named | par.nsf.gov/servlets/purl/10497401 |
| 2022 | Psychological Measurement in the Information Age: Machine-Learned Computational Models | not-named | par.nsf.gov/servlets/purl/10341078 |
| 2022 | A deep dive into microphone hardware for recording collaborative group work | not-named | par.nsf.gov/servlets/purl/10497216 |
| 2022 | CHIA: CHoosing Instances to Annotate for Machine Translation | not-named | par.nsf.gov/servlets/purl/10494307 |
| 2022 | Investigating Temporal Dynamics Underlying Successful Collaborative Problem Solving Behaviors w | not-named | par.nsf.gov/servlets/purl/10497421 |
| 2022 | A Conceptual Framework for Investigating and Mitigating Machine-Learning Measurement Bias (MLMB | not-named | par.nsf.gov/servlets/purl/10381146 |
| 2022 | “Beautiful work, you're rock stars!”: Teacher Analytics to Uncover Discourse that Supports or U | not-named | par.nsf.gov/servlets/purl/10379559 |
| 2022 | Challenges and Feasibility of Automatic Speech Recognition for Modeling Student Collaborative D | not-named | par.nsf.gov/servlets/purl/10499102 |
| 2022 | Taking a Deeper Look at the Brain: Predicting Visual Perceptual and Working Memory Load From Hi | not-named | par.nsf.gov/servlets/purl/10343949 |
| 2022 | Mixed-Reality Robot Behavior Replay: A System Implementation | not-named | par.nsf.gov/servlets/purl/10403587 |
| 2022 | Towards an Understanding of Physical vs Virtual Robot Appendage Design | not-named | par.nsf.gov/servlets/purl/10340523 |
| 2022 | Projecting Robot Navigation Paths: Hardware and Software for Projected AR | not-named | par.nsf.gov/servlets/purl/10312685 |
| 2023 | Interdisciplinary views of fNIRS: Current advancements, equity challenges, and an agenda for fu | not-named | www.frontiersin.org/articles/10.3389/fnint.2023.1059679/pdf |
| 2023 | Using Speech Patterns to Model the Dimensions of Teamness in Human-Agent Teams | not-named | par.nsf.gov/servlets/purl/10499589 |
| 2023 | Friend or foe: classifying collaborative interactions using fNIRS | not-named | http://scholar.colorado.edu/downloads/vq27zq32x |
| 2023 | Synerg-eye-zing: Decoding Nonlinear Gaze Dynamics Underlying Successful Collaborations in Co-lo | not-named | par.nsf.gov/servlets/purl/10499794 |
| 2023 | Stringesthesia: Dynamically Shifting Musical Agency Between Audience and Performer Based on Tru | not-named | arxiv.org/pdf/2309.05786 |
| 2023 | Investigating collaborative problem solving skills and outcomes across computer-based tasks | not-named | par.nsf.gov/servlets/purl/10499492 |
| 2023 | Dynamical Measurement of Team Resilience | not-named | par.nsf.gov/servlets/purl/10499591 |
| 2023 | Engagement Detection and Its Applications in Learning: A Tutorial and Selective Review | not-named | par.nsf.gov/servlets/purl/10499493 |
| 2023 | Toward the Validation of a Novel Measure of Individuals’ Influence During Team Collaborations | not-named | par.nsf.gov/servlets/purl/10499598 |
| 2023 | Development of a Real-Time Trust/Distrust Metric Using Interactive Hybrid Cognitive Task Analys | not-named | par.nsf.gov/servlets/purl/10499795 |
| 2023 | “They were learning from us as we were learning from them”: perceived experiences in co-design  | not-named | par.nsf.gov/servlets/purl/10499790 |
| 2023 | Evaluating Multimodal Behavior Schemas with VoxWorld | not-named | par.nsf.gov/servlets/purl/10499516 |
| 2023 | Compositional clustering: Applications to multi-label object recognition and speaker identifica | not-named | par.nsf.gov/servlets/purl/10434549 |
| 2023 | CPSCoach: The Design and Implementation of Intelligent Collaborative Problem Solving Feedback | not-named | par.nsf.gov/servlets/purl/10499513 |
| 2023 | A Multi-theoretic Analysis of Collaborative Discourse: A Step Towards AI-Facilitated Student Co | not-named | par.nsf.gov/servlets/purl/10499506 |
| 2023 | A Comparative Analysis of Automatic Speech Recognition Errors in Small Group Classroom Discours | not-named | par.nsf.gov/servlets/purl/10499496 |
| 2023 | Teachers’ Learning to Support Students During Science Inquiry: Managing Student Uncertainty in  | not-named | par.nsf.gov/servlets/purl/10499782 |
| 2023 | Examining Nonverbal Interactions to Better Understand Collaborative Learning | not-named | par.nsf.gov/servlets/purl/10499784 |
| 2023 | Recurrence Quantification Analysis of Eye Gaze Dynamics During Team Collaboration | not-named | par.nsf.gov/servlets/purl/10499779 |
| 2023 | Toward a debugging pedagogy: helping students learn to get unstuck with physical computing syst | not-named | par.nsf.gov/servlets/purl/10499783 |
| 2023 | A Survey of Challenges and Methods in the Computational Modeling of Multi-Party Dialog | not-named | par.nsf.gov/servlets/purl/10499590 |
| 2023 | Comparing Neural Question Generation Architectures for Reading Comprehension | not-named | par.nsf.gov/servlets/purl/10499793 |
| 2023 | CAMRA: Copilot for AMR Annotation | not-named | par.nsf.gov/servlets/purl/10499495 |
| 2023 | Diverse Retrieval-Augmented In-Context Learning for Dialogue State Tracking | not-named | par.nsf.gov/servlets/purl/10499603 |
| 2023 | Now Look Here! ⇓Mixed Reality Improves Robot Communication Without Cognitive Overload | not-named | par.nsf.gov/servlets/purl/10403578 |
| 2023 | Review of HIV Self Testing Technologies and Promising Approaches for the Next Generation | not-named | par.nsf.gov/servlets/purl/10413380 |
| 2023 | Virtual, Augmented, and Mixed Reality for Human-robot Interaction: A Survey and Virtual Design  | not-named | par.nsf.gov/servlets/purl/10468495 |
| 2023 | Best of Both Worlds? Combining Different Forms of Mixed Reality Deictic Gestures | not-named | par.nsf.gov/servlets/purl/10403565 |
| 2023 | Crossing Reality: Comparing Physical and Virtual Robot Deixis | not-named | par.nsf.gov/servlets/purl/10402626 |
| 2024 | From learning optimization to learner flourishing: Reimagining AI in Education at the Institute | not-named | par.nsf.gov/servlets/purl/10499524 |
| 2024 | When Text and Speech are Not Enough: A Multimodal Dataset of Collaboration in a Situated Task | not-named | storage.googleapis.com/jnl-up-j-johd-files/journals/1/articl |
| 2024 | Cortical cognitive processing during reading captured using functional-near infrared spectrosco | not-named | www.nature.com/articles/s41598-024-69630-x.pdf |
| 2024 | Putting the “Brain” Back in the Eye-Mind Link: Aligning Eye Movements and Brain Activations Dur | not-named | par.nsf.gov/servlets/purl/10556468 |
| 2024 | A Typology for the Application of Team Coordination Dynamics Across Increasing Levels of Dynami | not-named | par.nsf.gov/servlets/purl/10497419 |
| 2024 | From the Lab to the Wild: Examining Generalizability of Video-based Mind Wandering Detection | not-named | par.nsf.gov/servlets/purl/10556464 |
| 2024 | Characterizing Teacher Support of Debugging with Physical Computing: Debugging Pedagogies in Pr | not-named | par.nsf.gov/servlets/purl/10586875 |
| 2024 | Dense Paraphrasing for multimodal dialogue interpretation | not-named | par.nsf.gov/servlets/purl/10588532 |
| 2024 | Lexical Event Models for Multimodal Dialogues | not-named | par.nsf.gov/servlets/purl/10586895 |
| 2024 | Semantically Enriched Text Generation for QA through Dense Paraphrasing | not-named | par.nsf.gov/servlets/purl/10586892 |
| 2024 | Classifying Tutor Discursive Moves at Scale in Mathematics Classrooms with Large Language Model | not-named | par.nsf.gov/servlets/purl/10586888 |
| 2024 | Lessons Learned from Co-Designing Phenomena Driven Student Centered AI Curriculum with Teachers | not-named | par.nsf.gov/servlets/purl/10586871 |
| 2024 | Using Adapted Conjecture Maps to Foster Interdisciplinary Collaboration Between Learning Scient | not-named | par.nsf.gov/servlets/purl/10586872 |
| 2024 | MOSAIC Protocol: Analyzing Small Group Work to Gain Insights into Collaboration Support for Mid | not-named | par.nsf.gov/servlets/purl/10586879 |
| 2024 | Co-design Partners as Transformative Learners: Imagining Ideal Technology for Schools by Center | not-named | par.nsf.gov/servlets/purl/10586874 |
| 2024 | Building a Broad Infrastructure for Uniform Meaning Representations | not-named | par.nsf.gov/servlets/purl/10586870 |
| 2024 | GLAMR: Augmenting AMR with GL-VerbNet Event Structure | not-named | par.nsf.gov/servlets/purl/10588531 |
| 2024 | ChainNet: Structured Metaphor and Metonymy in WordNet | not-named | par.nsf.gov/servlets/purl/10586887 |
| 2024 | Encoding Gesture in Multimodal Dialogue: Creating a Corpus of Multimodal AMR | not-named | par.nsf.gov/servlets/purl/10586885 |
| 2024 | Linear Cross-document Event Coreference Resolution with X-AMR | not-named | par.nsf.gov/servlets/purl/10586867 |
| 2024 | Computational Modeling of Collaborative Discourse to Enable Feedback and Reflection in Middle S | not-named | par.nsf.gov/servlets/purl/10499523 |
| 2024 | PropBank goes Public: Incorporation into Wikidata | not-named | par.nsf.gov/servlets/purl/10586899 |
| 2024 | Improving collaborative problem-solving skills via automated feedback and scaffolding: a quasi- | not-named | par.nsf.gov/servlets/purl/10499526 |
| 2024 | A framework for language technologies in behavioral research and clinical applications: Ethical | not-named | par.nsf.gov/servlets/purl/10499588 |
| 2024 | Modeling Theory of Mind in Multimodal HCI | not-named | par.nsf.gov/servlets/purl/10588543 |
| 2024 | Linguistically Conditioned Semantic Textual Similarity | not-named | par.nsf.gov/servlets/purl/10588537 |
| 2024 | HaRMoNEE at SemEval-2024 Task 6: Tuning-based Approaches to Hallucination Recognition | not-named | par.nsf.gov/servlets/purl/10586891 |
| 2024 | Spatial and Temporal Language Understanding: Representation, Reasoning, and Grounding | not-named | par.nsf.gov/servlets/purl/10586883 |
| 2024 | “Any Other Thoughts, Hedgehog?” Linking Deliberation Chains in Collaborative Dialogues | not-named | par.nsf.gov/servlets/purl/10586889 |
| 2024 | Tracking Classroom Movement Patterns with Person Re-ID | not-named | par.nsf.gov/servlets/purl/10588542 |
| 2024 | “Keep up the good work!”: Using Constraints in Zero Shot Prompting to Generate Supportive Teach | not-named | par.nsf.gov/servlets/purl/10586894 |
| 2025 | BrAIn Jam: neural signal-informed adaptive system for drumming collaboration with an AI-driven  | not-named | www.frontiersin.org/journals/computer-science/articles/10.33 |
| 2025 | Examining Support Moments With a Conversational AI Partner | not-named | repository.isls.org//bitstream/1/11840/1/CSCL2025_169-177.pd |
| 2025 | Decision-Making Amid Information-Based Threats in Sociotechnical Systems: A Review | not-named | arxiv.org/pdf/2511.11595 |
| 2025 | Development and Validation of a Spacesuit Simulator for Collecting Experimental Physiological a | not-named | ttu-ir.tdl.org/bitstreams/0f82b4f2-e21e-405f-8d72-9f324dc4b3 |
| 2025 | Co-designing AI with youth partners: Enabling ideal classroom relationships through a novel AI  | not-named | par.nsf.gov/servlets/purl/10586873 |
| 2025 | Feature Contributions to Multimodal Interpretation of Common Ground | not-named | par.nsf.gov/servlets/purl/10586880 |
| 2025 | “It feels like we're not meeting the criteria”: Examining and Mitigating the Cascading Effects  | not-named | par.nsf.gov/servlets/purl/10588526 |
| 2025 | The Relationship between Collaborative Problem-Solving Skills and Group-to-Individual Learning  | not-named | par.nsf.gov/servlets/purl/10588524 |
| 2025 | Understanding Collaborative Learning Processes and Outcomes Through Student Discourse Dynamics | not-named | par.nsf.gov/servlets/purl/10586893 |
| 2025 | Propositional Extraction from Collaborative Naturalistic Dialogues | not-named | par.nsf.gov/servlets/purl/10588539 |
| 2025 | Optimizing Speaker Diarization for the Classroom: Applications in Timing Student Speech and Dis | not-named | par.nsf.gov/servlets/purl/10588540 |
| 2025 | Teaching chemical product design | not-named | par.nsf.gov/servlets/purl/10634288 |
| 2025 | Multimodal Common Ground Annotation for Partial Information Collaborative Problem Solving | not-named | par.nsf.gov/servlets/purl/10683356 |
| 2025 | Dynamic Epistemic Friction in Dialogue | not-named | par.nsf.gov/servlets/purl/10683354 |
| 2025 | ScanEZ: Integrating Cognitive Models with Self-Supervised Learning for Spatiotemporal Scanpath  | not-named | par.nsf.gov/servlets/purl/10683353 |
| 2026 | Behavioral Outcomes of Human Cognitive Security within an Integrative Modeling Framework | not-named | arxiv.org/pdf/2603.01355 |
| 2026 | Leveraging fNIRS to Evaluate Workload for Adaptive Training in Virtual Reality | not-named | arxiv.org/pdf/2605.06909 |
| 2026 | ERP-XTTN: interpretable prototype-guided cross-attention for cross-subject ERP classification | not-named | iopscience.iop.org/article/10.1088/1741-2552/ae9f95/pdf |
| 2026 | Designing Experiment Software Optimized for Data Yield, Immersion, and Control in Naturalistic  | not-named | openaccess-api.cms-conferences.org/articles/download/979-8-9 |
