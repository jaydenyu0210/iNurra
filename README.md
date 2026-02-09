# iNurra

> Your private nurse in your pocket—making care easier, one photo at a time.

## Project Inspiration
As a registered nurse, I see the "Gap" every day. Patients are often discharged with complex plans they simply cannot follow. From "Lose-Lose" to "Win-Win" "Frequent Flyers"—patients trapped in a cycle of readmission. Patients lose their health and dignity, while hospitals lose millions in 30-day readmission penalties.

iNurra is a centralized, patient-first portal that turns this "lose-lose" into a "win-win" by simplifying home care.

## What it Does (Features)
iNurra uses AI to translate clinical complexity into visual clarity:

- **Visual Cognitive Calendar**: Users scan discharge papers; the AI identifies appointments and "flies" them into a visual timeline.
- **Medication Decoder**: No more confusion between brand and generic names. By scanning a bottle, the AI explains.
- **Body & Skin Tracker**: For body condition management, users track foot health or wound healing through photos. It even helps with family care, like tracking a child's eczema progress.
- **Automated Triage**: When the AI detects a Red Flag in a photo, it can automatically alert the care team via a provider portal.

## The Impact
The goal of iNurra is to reduce the 30-day readmission rate by ensuring patients actually understand and follow their care plans.
By supporting the family unit and bridging the language barrier, we are providing dignified aging and clinical security for the most vulnerable populations in our community.

## How we built it
We built **iNurra** using **React Native** and **Expo** to ensure a smooth, native-like experience on any mobile device. For our backend and authentication, we leveraged **Supabase**, providing real-time data and secure storage for sensitive health information. The core intelligence is powered by **Google Gemini**, which we fine-tuned to recognize and interpret medical documents—transforming raw text from photos into structured, actionable health data.

## Challenges we ran into
One of our biggest hurdles was prompting the AI to consistently extract accurate data from messy, real-world photos—like crumpled discharge papers or curved pill bottles. We also spent significant time refining the user interface to ensure it was accessible and intuitive for elderly patients who might not be tech-savvy, balancing powerful features with extreme simplicity.

## Accomplishments that we're proud of
We are incredibly proud of successfully using AI to bridge the critical "Gap" between hospital discharge and clear home care. Beyond the technical milestones of the **Visual Cognitive Calendar** and **Medication Decoder**, we are proud to have built a comprehensive safety net with features like the **Body & Skin Tracker** and **Automated Triage**. Seeing these components work together to potentially reduce 30-day readmissions and provide dignified aging for vulnerable populations is our greatest achievement.

## What we learned
We learned that in healthcare, clarity is just as important as accuracy. We discovered that AI isn't just a tool for automation, but a bridge for empathy—translating the cold clinical language of a hospital into the warm, understandable language of home care. We also realized how much non-compliance is due simply to confusion rather than unwillingness.

## What's next for iNurra
Our roadmap is focused on deepening the connection between patients and providers. We plan to integrate directly with hospital EHR systems to make the data flow even more seamless. We also aim to expand our language offerings to support non-English speaking families more effectively. Finally, we want to implement predictive analytics to alert families of potential health declines *before* they become emergencies.

## License

MIT

## Support

For questions or issues, please open a GitHub issue.
