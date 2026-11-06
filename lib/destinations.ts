// The seven destinations, ported verbatim from the original single-file
// site (loy-krathong-seven-nights__1.html, DESTINATIONS). This is the
// festival content the Rules block rests on: each night has one
// destination, one special mission and one secret. The missions,
// secrets and milestones are not restored yet (see VERIFICATION.md),
// but their content lives here so restoring them is a UI job, not a
// content job. Scene-rendering fields from the original (lat/lon,
// palette, ambience) are dropped: the rebuild has one river scene.

export type Localised = { en: string; th: string };

export interface Destination {
  id: string;
  day: number;
  name: Localised;
  river: Localised;
  theme: Localised;
  story: Localised;
  welcome: Localised;
  special: { kind: string; title: Localised; detail: Localised };
  milestone: { name: Localised; stages: Localised[]; bonus: Localised };
  secret: {
    name: Localised;
    symbol: string;
    hint: Localised;
    riddle: Localised;
    options: Localised[];
    story: Localised;
  };
}

/** The stamp glyph for each destination (Rules: STAMP_ICON). */
export const STAMP_ICON: Record<string, string> = {
  bangkok: '🛕', sukhothai: '🪷', chiang_mai: '🏮', tak: '🕯️',
  ayutthaya: '🌙', amphawa: '✨', roi_et: '🌕',
};

/** The glyph for each kind of special evidence (Rules: SPECIAL_ICON). */
export const SPECIAL_ICON: Record<string, string> = {
  float: '🪷', quiz: '📜', blessing: '🏮', candle: '🕯️',
  gratitude: '🙏', share: '💌', finale: '🎆',
};

export const DESTINATIONS: Destination[] = 
[
  {
    "day": 1,
    "name": {
      "en": "Bangkok",
      "th": "กรุงเทพฯ"
    },
    "river": {
      "en": "Chao Phraya River",
      "th": "แม่น้ำเจ้าพระยา"
    },
    "theme": {
      "en": "The First Wish",
      "th": "คำอธิษฐานแรก"
    },
    "story": {
      "en": "Our journey begins on a river inspired by the Chao Phraya, beneath a temple silhouette inspired by Wat Arun, the Temple of Dawn. Long-tail boats glide past and the riverside glows gold.",
      "th": "การเดินทางเริ่มต้นบนสายน้ำที่ได้แรงบันดาลใจจากแม่น้ำเจ้าพระยา ใต้เงาพระปรางค์ที่ได้แรงบันดาลใจจากวัดอรุณฯ วัดแห่งรุ่งอรุณ เรือหางยาวแล่นผ่าน ริมน้ำเปล่งประกายสีทอง"
    },
    "welcome": {
      "en": "Welcome to Bangkok. Every journey starts with a single wish.",
      "th": "ยินดีต้อนรับสู่กรุงเทพฯ ทุกการเดินทางเริ่มต้นจากคำอธิษฐานเพียงหนึ่งเดียว"
    },
    "special": {
      "kind": "float",
      "title": {
        "en": "Float your first wish",
        "th": "ลอยคำอธิษฐานแรก"
      },
      "detail": {
        "en": "Create and float a wish on the river today.",
        "th": "เขียนและลอยคำอธิษฐานบนสายน้ำวันนี้"
      }
    },
    "milestone": {
      "name": {
        "en": "Golden Riverside",
        "th": "ริมน้ำสีทอง"
      },
      "stages": [
        {
          "en": "Lights flicker on along the bank",
          "th": "ไฟริมน้ำเริ่มสว่างขึ้น"
        },
        {
          "en": "Boats light their lanterns",
          "th": "เรือจุดโคมไฟ"
        },
        {
          "en": "The temple glows gold",
          "th": "พระปรางค์เปล่งแสงสีทอง"
        },
        {
          "en": "The whole riverside celebrates",
          "th": "ริมน้ำทั้งสายเฉลิมฉลอง"
        }
      ],
      "bonus": {
        "en": "Together you lit the riverside. A thousand small lights on the water, and every one of them a wish.",
        "th": "พวกเราจุดไฟริมน้ำด้วยกัน แสงไฟนับพันบนสายน้ำ และทุกดวงคือคำอธิษฐาน"
      }
    },
    "secret": {
      "name": {
        "en": "The Golden Ripple",
        "th": "ระลอกน้ำสีทอง"
      },
      "symbol": "〰️",
      "hint": {
        "en": "Where the moon’s path meets the temple’s reflection, the water shimmers differently.",
        "th": "ตรงที่ทางแสงจันทร์บรรจบเงาพระปรางค์ ผิวน้ำระยิบระยับไม่เหมือนที่อื่น"
      },
      "riddle": {
        "en": "I am born when something touches still water, and I grow until I vanish. What am I?",
        "th": "ฉันเกิดเมื่อมีสิ่งใดแตะผิวน้ำนิ่ง ฉันเติบโตจนหายไป ฉันคืออะไร"
      },
      "options": [
        {
          "en": "A ripple",
          "th": "ระลอกน้ำ"
        },
        {
          "en": "A current",
          "th": "กระแสน้ำ"
        },
        {
          "en": "A reflection",
          "th": "เงาสะท้อน"
        }
      ],
      "story": {
        "en": "The first fragment: a single wish, set gently on the water, sends ripples further than you can see.",
        "th": "ชิ้นส่วนแรก: คำอธิษฐานเพียงหนึ่งที่วางลงบนสายน้ำอย่างแผ่วเบา ส่งระลอกไปไกลกว่าที่ตาเห็น"
      }
    },
    "id": "bangkok"
  },
  {
    "day": 2,
    "name": {
      "en": "Sukhothai",
      "th": "สุโขทัย"
    },
    "river": {
      "en": "Sukhothai Historical Park",
      "th": "อุทยานประวัติศาสตร์สุโขทัย"
    },
    "theme": {
      "en": "The Light of History",
      "th": "แสงแห่งประวัติศาสตร์"
    },
    "story": {
      "en": "Sukhothai, whose name is often translated as “Dawn of Happiness”, is where many say Loy Krathong began. This scene is inspired by its lotus-bud chedis, stone ruins and lotus ponds.",
      "th": "สุโขทัย ซึ่งมักแปลว่า “รุ่งอรุณแห่งความสุข” เป็นที่ที่หลายคนเชื่อว่าประเพณีลอยกระทงเริ่มต้นขึ้น ฉากนี้ได้แรงบันดาลใจจากเจดีย์ทรงดอกบัวตูม ซากโบราณสถาน และสระบัว"
    },
    "welcome": {
      "en": "Welcome to Sukhothai. Candlelight has crossed these waters for centuries.",
      "th": "ยินดีต้อนรับสู่สุโขทัย แสงเทียนลอยผ่านสายน้ำนี้มานานหลายศตวรรษ"
    },
    "special": {
      "kind": "quiz",
      "title": {
        "en": "A story from Sukhothai",
        "th": "เรื่องเล่าจากสุโขทัย"
      },
      "detail": {
        "en": "Read the legend of the first krathong and answer one question.",
        "th": "อ่านตำนานกระทงใบแรกและตอบคำถามหนึ่งข้อ"
      }
    },
    "milestone": {
      "name": {
        "en": "Ancient Temple Lights",
        "th": "แสงไฟโบราณสถาน"
      },
      "stages": [
        {
          "en": "Candles appear along the paths",
          "th": "เทียนปรากฏตามทางเดิน"
        },
        {
          "en": "Lotus ponds begin to glow",
          "th": "สระบัวเริ่มเรืองแสง"
        },
        {
          "en": "The great chedi is lit",
          "th": "เจดีย์องค์ใหญ่สว่างไสว"
        },
        {
          "en": "The whole old city shines",
          "th": "เมืองเก่าทั้งเมืองเปล่งแสง"
        }
      ],
      "bonus": {
        "en": "Legend tells of a lotus krathong made in this old city long ago. Tonight, your lights joined that story.",
        "th": "ตำนานเล่าถึงกระทงดอกบัวที่ทำขึ้นในเมืองเก่าแห่งนี้เมื่อนานมาแล้ว คืนนี้แสงของพวกเราได้ร่วมเป็นส่วนหนึ่งของเรื่องราวนั้น"
      }
    },
    "secret": {
      "name": {
        "en": "The Ancient Flame",
        "th": "เปลวไฟโบราณ"
      },
      "symbol": "🕯️",
      "hint": {
        "en": "Among the ruins, one small flame burns steadier than the rest.",
        "th": "ท่ามกลางซากโบราณ มีเปลวไฟเล็ก ๆ ดวงหนึ่งที่ลุกโชนนิ่งกว่าดวงอื่น"
      },
      "riddle": {
        "en": "Sukhothai’s name is often translated as…",
        "th": "ชื่อ “สุโขทัย” มักแปลว่า…"
      },
      "options": [
        {
          "en": "Dawn of Happiness",
          "th": "รุ่งอรุณแห่งความสุข"
        },
        {
          "en": "City of Angels",
          "th": "เมืองแห่งเทวดา"
        },
        {
          "en": "River of Kings",
          "th": "สายน้ำแห่งกษัตริย์"
        }
      ],
      "story": {
        "en": "The second fragment: light that is cared for can last for centuries.",
        "th": "ชิ้นส่วนที่สอง: แสงที่ได้รับการดูแลอย่างดี อยู่ได้นานนับศตวรรษ"
      }
    },
    "id": "sukhothai"
  },
  {
    "day": 3,
    "name": {
      "en": "Chiang Mai",
      "th": "เชียงใหม่"
    },
    "river": {
      "en": "Ping River",
      "th": "แม่น้ำปิง"
    },
    "theme": {
      "en": "The Sky of Hope",
      "th": "ท้องฟ้าแห่งความหวัง"
    },
    "story": {
      "en": "In the north, the festival is known as Yi Peng. This scene is inspired by Lanna-style hanging lanterns along the Ping River. Our lanterns stay hanging, glowing over the water.",
      "th": "ทางภาคเหนือ เทศกาลนี้เรียกว่ายี่เป็ง ฉากนี้ได้แรงบันดาลใจจากโคมแขวนแบบล้านนาริมแม่น้ำปิง โคมของเราแขวนอยู่กับที่ ส่องแสงเหนือสายน้ำ"
    },
    "welcome": {
      "en": "Welcome to Chiang Mai. Hope glows brightest when we share it.",
      "th": "ยินดีต้อนรับสู่เชียงใหม่ ความหวังจะสว่างที่สุดเมื่อเราแบ่งปันกัน"
    },
    "special": {
      "kind": "blessing",
      "title": {
        "en": "Send a blessing",
        "th": "ส่งคำอวยพร"
      },
      "detail": {
        "en": "Open a friend’s krathong and send them a blessing lantern.",
        "th": "เปิดกระทงของเพื่อนแล้วส่งโคมอวยพรให้เขา"
      }
    },
    "milestone": {
      "name": {
        "en": "Lantern Illumination",
        "th": "โคมไฟสว่างไสว"
      },
      "stages": [
        {
          "en": "The first lanterns light up",
          "th": "โคมดวงแรกสว่างขึ้น"
        },
        {
          "en": "Rows of lanterns glow",
          "th": "โคมเรียงแถวส่องแสง"
        },
        {
          "en": "Hundreds of lanterns shine",
          "th": "โคมนับร้อยส่องสว่าง"
        },
        {
          "en": "The whole river is lit with lanterns",
          "th": "สายน้ำทั้งสายสว่างด้วยโคมไฟ"
        }
      ],
      "bonus": {
        "en": "Hundreds of lanterns, each one lit by someone’s kindness. Hope looks like this.",
        "th": "โคมนับร้อยดวง แต่ละดวงจุดขึ้นด้วยความใจดีของใครสักคน ความหวังมีหน้าตาแบบนี้เอง"
      }
    },
    "secret": {
      "name": {
        "en": "The Lantern Whisper",
        "th": "เสียงกระซิบของโคมไฟ"
      },
      "symbol": "🏮",
      "hint": {
        "en": "One lantern hangs a little lower and glows a little warmer.",
        "th": "มีโคมดวงหนึ่งแขวนต่ำกว่า และส่องแสงอบอุ่นกว่าดวงอื่น"
      },
      "riddle": {
        "en": "“Lanna”, the old northern kingdom, means “land of a million…”",
        "th": "“ล้านนา” อาณาจักรเก่าทางเหนือ หมายถึงดินแดนแห่งล้าน…"
      },
      "options": [
        {
          "en": "Rice fields",
          "th": "ทุ่งนา"
        },
        {
          "en": "Mountains",
          "th": "ภูเขา"
        },
        {
          "en": "Temples",
          "th": "วัด"
        }
      ],
      "story": {
        "en": "The third fragment: hope is carried furthest when it is shared.",
        "th": "ชิ้นส่วนที่สาม: ความหวังจะไปได้ไกลที่สุดเมื่อเราแบ่งปันมัน"
      }
    },
    "id": "chiang_mai"
  },
  {
    "day": 4,
    "name": {
      "en": "Tak",
      "th": "ตาก"
    },
    "river": {
      "en": "Ping River",
      "th": "แม่น้ำปิง"
    },
    "theme": {
      "en": "A Thousand Lights",
      "th": "แสงนับพัน"
    },
    "story": {
      "en": "This scene is inspired by Loy Krathong Sai in Tak, where long chains of small lights drift down the Ping River together, like a string of stars on the water.",
      "th": "ฉากนี้ได้แรงบันดาลใจจากประเพณีลอยกระทงสายของจังหวัดตาก ที่สายแสงไฟเล็ก ๆ ลอยเรียงกันไปตามแม่น้ำปิง ราวกับสายดาวบนผืนน้ำ"
    },
    "welcome": {
      "en": "Welcome to Tak. Alone, a light is small. Together, it becomes a river.",
      "th": "ยินดีต้อนรับสู่ตาก แสงเดียวอาจดูเล็ก แต่เมื่อรวมกันก็กลายเป็นสายน้ำ"
    },
    "special": {
      "kind": "candle",
      "title": {
        "en": "Light a candle",
        "th": "จุดเทียน"
      },
      "detail": {
        "en": "Add your digital candle to the chain of lights.",
        "th": "เพิ่มเทียนดิจิทัลของคุณเข้าไปในสายแสงไฟ"
      }
    },
    "milestone": {
      "name": {
        "en": "Thousand Lights",
        "th": "แสงนับพัน"
      },
      "stages": [
        {
          "en": "The chain of lights begins",
          "th": "สายแสงไฟเริ่มต้นขึ้น"
        },
        {
          "en": "The chain stretches across the river",
          "th": "สายแสงไฟทอดยาวข้ามสายน้ำ"
        },
        {
          "en": "The bridge lights up",
          "th": "สะพานสว่างไสว"
        },
        {
          "en": "A thousand lights shine together",
          "th": "แสงนับพันส่องสว่างพร้อมกัน"
        }
      ],
      "bonus": {
        "en": "A thousand lights, joined into one long chain. None of them could have done this alone.",
        "th": "แสงนับพันดวง รวมกันเป็นสายยาวเพียงสายเดียว ไม่มีดวงไหนทำได้ด้วยตัวเองเพียงลำพัง"
      }
    },
    "secret": {
      "name": {
        "en": "The Endless Flame",
        "th": "เปลวไฟไม่รู้จบ"
      },
      "symbol": "🔥",
      "hint": {
        "en": "Follow the chain of lights back to where it begins.",
        "th": "ตามสายแสงไฟย้อนกลับไปยังจุดเริ่มต้น"
      },
      "riddle": {
        "en": "In Loy Krathong Sai, the small lamps floated on the river are traditionally made from…",
        "th": "ในประเพณีลอยกระทงสาย ตะคันเล็ก ๆ ที่ลอยบนสายน้ำมักทำจาก…"
      },
      "options": [
        {
          "en": "Coconut shells",
          "th": "กะลามะพร้าว"
        },
        {
          "en": "Paper",
          "th": "กระดาษ"
        },
        {
          "en": "Glass",
          "th": "แก้ว"
        }
      ],
      "story": {
        "en": "The fourth fragment: kindness joined together never runs out.",
        "th": "ชิ้นส่วนที่สี่: ความใจดีที่ร้อยต่อกันไม่มีวันหมด"
      }
    },
    "id": "tak"
  },
  {
    "day": 5,
    "name": {
      "en": "Ayutthaya",
      "th": "อยุธยา"
    },
    "river": {
      "en": "Historic waterways",
      "th": "สายน้ำประวัติศาสตร์"
    },
    "theme": {
      "en": "Wishes Across Time",
      "th": "คำอธิษฐานข้ามกาลเวลา"
    },
    "story": {
      "en": "For about four hundred years, Ayutthaya was the capital of Siam, an island city ringed by rivers. This scene is inspired by its moonlit temple ruins and calm waters.",
      "th": "อยุธยาเคยเป็นราชธานีของสยามนานราวสี่ร้อยปี เป็นเมืองเกาะที่มีแม่น้ำล้อมรอบ ฉากนี้ได้แรงบันดาลใจจากซากวัดใต้แสงจันทร์และสายน้ำที่สงบนิ่ง"
    },
    "welcome": {
      "en": "Welcome to Ayutthaya. Some things last because we remember to be thankful for them.",
      "th": "ยินดีต้อนรับสู่อยุธยา บางสิ่งยังคงอยู่เพราะเราไม่ลืมที่จะขอบคุณ"
    },
    "special": {
      "kind": "gratitude",
      "title": {
        "en": "A lantern of thanks",
        "th": "โคมแห่งความขอบคุณ"
      },
      "detail": {
        "en": "Choose who or what you are grateful for and set its lantern on the water.",
        "th": "เลือกสิ่งที่คุณรู้สึกขอบคุณ แล้ววางโคมของมันลงบนสายน้ำ"
      }
    },
    "milestone": {
      "name": {
        "en": "Moonlit Temple",
        "th": "วัดใต้แสงจันทร์"
      },
      "stages": [
        {
          "en": "Moonlight falls on the ruins",
          "th": "แสงจันทร์ส่องลงบนซากวัด"
        },
        {
          "en": "The prangs begin to glow",
          "th": "พระปรางค์เริ่มเรืองแสง"
        },
        {
          "en": "A hidden temple appears in the reflection",
          "th": "วัดที่ซ่อนอยู่ปรากฏในเงาสะท้อน"
        },
        {
          "en": "The hidden temple is revealed",
          "th": "วัดที่ซ่อนอยู่เผยโฉม"
        }
      ],
      "bonus": {
        "en": "The hidden temple stood in the reflection all along, waiting for enough light to be seen.",
        "th": "วัดที่ซ่อนอยู่ปรากฏอยู่ในเงาสะท้อนมาตลอด รอเพียงแสงที่มากพอให้มองเห็น"
      }
    },
    "secret": {
      "name": {
        "en": "The Forgotten Reflection",
        "th": "เงาสะท้อนที่ถูกลืม"
      },
      "symbol": "🌗",
      "hint": {
        "en": "Look at the water, not the sky: one temple appears only in its reflection.",
        "th": "ลองมองที่ผิวน้ำแทนท้องฟ้า มีวัดหนึ่งที่ปรากฏเฉพาะในเงาสะท้อน"
      },
      "riddle": {
        "en": "For roughly how long was Ayutthaya the capital of Siam?",
        "th": "อยุธยาเป็นราชธานีของสยามนานประมาณเท่าใด"
      },
      "options": [
        {
          "en": "About 400 years",
          "th": "ประมาณ 400 ปี"
        },
        {
          "en": "About 100 years",
          "th": "ประมาณ 100 ปี"
        },
        {
          "en": "About 1,000 years",
          "th": "ประมาณ 1,000 ปี"
        }
      ],
      "story": {
        "en": "The fifth fragment: when we look back with gratitude, what we lost becomes part of what we are.",
        "th": "ชิ้นส่วนที่ห้า: เมื่อเรามองย้อนกลับด้วยความขอบคุณ สิ่งที่สูญไปก็กลายเป็นส่วนหนึ่งของตัวเรา"
      }
    },
    "id": "ayutthaya"
  },
  {
    "day": 6,
    "name": {
      "en": "Amphawa",
      "th": "อัมพวา"
    },
    "river": {
      "en": "Samut Songkhram canals",
      "th": "คลองสมุทรสงคราม"
    },
    "theme": {
      "en": "The River of Togetherness",
      "th": "สายน้ำแห่งความผูกพัน"
    },
    "story": {
      "en": "This scene is inspired by Amphawa’s canal community in Samut Songkhram: wooden houses on stilts, little bridges, warm windows, and fireflies gathering in the riverside trees.",
      "th": "ฉากนี้ได้แรงบันดาลใจจากชุมชนริมคลองอัมพวา จังหวัดสมุทรสงคราม บ้านไม้ใต้ถุนสูง สะพานเล็ก ๆ หน้าต่างที่มีแสงไฟอบอุ่น และหิ่งห้อยที่มาชุมนุมบนต้นไม้ริมน้ำ"
    },
    "welcome": {
      "en": "Welcome to Amphawa. Here, neighbours share the same river.",
      "th": "ยินดีต้อนรับสู่อัมพวา ที่นี่เพื่อนบ้านใช้สายน้ำเดียวกัน"
    },
    "special": {
      "kind": "share",
      "title": {
        "en": "Share the river",
        "th": "แบ่งปันสายน้ำ"
      },
      "detail": {
        "en": "Save and share your wish card, or send a blessing lantern to a friend.",
        "th": "บันทึกและแบ่งปันการ์ดคำอธิษฐานของคุณ หรือส่งโคมอวยพรให้เพื่อน"
      }
    },
    "milestone": {
      "name": {
        "en": "Firefly Canal",
        "th": "คลองหิ่งห้อย"
      },
      "stages": [
        {
          "en": "The first fireflies appear",
          "th": "หิ่งห้อยกลุ่มแรกปรากฏ"
        },
        {
          "en": "Windows light up along the canal",
          "th": "หน้าต่างริมคลองสว่างขึ้น"
        },
        {
          "en": "Fireflies fill the trees",
          "th": "หิ่งห้อยเต็มต้นไม้"
        },
        {
          "en": "The whole canal sparkles",
          "th": "คลองทั้งสายระยิบระยับ"
        }
      ],
      "bonus": {
        "en": "The canal is full of light now. Every window, every firefly, every krathong: a neighbour.",
        "th": "คลองทั้งสายเต็มไปด้วยแสง ทุกหน้าต่าง ทุกหิ่งห้อย ทุกกระทง คือเพื่อนบ้าน"
      }
    },
    "secret": {
      "name": {
        "en": "The Heart of the River",
        "th": "หัวใจแห่งสายน้ำ"
      },
      "symbol": "💛",
      "hint": {
        "en": "Among the fireflies, one light never blinks.",
        "th": "ท่ามกลางหิ่งห้อย มีแสงดวงหนึ่งที่ไม่เคยกะพริบ"
      },
      "riddle": {
        "en": "Amphawa’s fireflies famously gather in which riverside trees?",
        "th": "หิ่งห้อยที่อัมพวามักมาชุมนุมบนต้นไม้ชนิดใดริมน้ำ"
      },
      "options": [
        {
          "en": "Lamphu trees",
          "th": "ต้นลำพู"
        },
        {
          "en": "Coconut palms",
          "th": "ต้นมะพร้าว"
        },
        {
          "en": "Mango trees",
          "th": "ต้นมะม่วง"
        }
      ],
      "story": {
        "en": "The sixth fragment: a river is only a river until people share it.",
        "th": "ชิ้นส่วนที่หก: สายน้ำเป็นเพียงสายน้ำ จนกว่าผู้คนจะได้แบ่งปันมันร่วมกัน"
      }
    },
    "id": "amphawa"
  },
  {
    "day": 7,
    "name": {
      "en": "Roi Et",
      "th": "ร้อยเอ็ด"
    },
    "river": {
      "en": "Bueng Phlan Chai",
      "th": "บึงพลาญชัย"
    },
    "theme": {
      "en": "The Seven Lights Unite",
      "th": "เจ็ดแสงรวมเป็นหนึ่ง"
    },
    "story": {
      "en": "Our journey ends on a great moonlit lake inspired by Bueng Phlan Chai in Roi Et, a name that means “one hundred and one”. Every light from the journey gathers here.",
      "th": "การเดินทางของเราสิ้นสุดที่บึงใหญ่ใต้แสงจันทร์ ซึ่งได้แรงบันดาลใจจากบึงพลาญชัย จังหวัดร้อยเอ็ด ชื่อที่หมายถึง “หนึ่งร้อยเอ็ด” แสงทุกดวงจากการเดินทางมารวมกันที่นี่"
    },
    "welcome": {
      "en": "Welcome to Roi Et. Seven nights, one river of wishes.",
      "th": "ยินดีต้อนรับสู่ร้อยเอ็ด เจ็ดค่ำคืน หนึ่งสายน้ำแห่งคำอธิษฐาน"
    },
    "special": {
      "kind": "finale",
      "title": {
        "en": "Join the celebration",
        "th": "ร่วมงานเฉลิมฉลอง"
      },
      "detail": {
        "en": "Float your krathong to the centre of the lake for the grand finale.",
        "th": "ลอยกระทงของคุณไปกลางบึงเพื่อร่วมชมการเฉลิมฉลองครั้งยิ่งใหญ่"
      }
    },
    "milestone": {
      "name": {
        "en": "Seven Lights Grand Finale",
        "th": "เจ็ดแสงแห่งการเฉลิมฉลอง"
      },
      "stages": [
        {
          "en": "The pavilion lights up",
          "th": "ศาลากลางน้ำสว่างขึ้น"
        },
        {
          "en": "Lights from every destination arrive",
          "th": "แสงจากทุกจุดหมายเดินทางมาถึง"
        },
        {
          "en": "The lake turns gold",
          "th": "บึงกลายเป็นสีทอง"
        },
        {
          "en": "The grand finale begins",
          "th": "การเฉลิมฉลองครั้งยิ่งใหญ่เริ่มต้น"
        }
      ],
      "bonus": {
        "en": "Seven lights, from seven places, on one lake. This is what we made together.",
        "th": "เจ็ดแสงจากเจ็ดแห่ง บนบึงเดียวกัน นี่คือสิ่งที่พวกเราสร้างขึ้นด้วยกัน"
      }
    },
    "secret": {
      "name": {
        "en": "The Heart of the Moon",
        "th": "หัวใจแห่งดวงจันทร์"
      },
      "symbol": "🌕",
      "hint": {
        "en": "When the lights of the journey gather, look to the centre of the lake.",
        "th": "เมื่อแสงจากการเดินทางมารวมกัน ลองมองไปที่กลางบึง"
      },
      "riddle": {
        "en": "The name “Roi Et” means…",
        "th": "ชื่อ “ร้อยเอ็ด” หมายถึง…"
      },
      "options": [
        {
          "en": "One hundred and one",
          "th": "หนึ่งร้อยเอ็ด"
        },
        {
          "en": "The seventh moon",
          "th": "ดวงจันทร์ดวงที่เจ็ด"
        },
        {
          "en": "A thousand lakes",
          "th": "บึงนับพัน"
        }
      ],
      "story": {
        "en": "The last fragment: a ripple, a flame, a whisper of hope, a chain of kindness, a grateful reflection, a shared river. Put together, they are the heart of the moon, and it shines because of all of us.",
        "th": "ชิ้นส่วนสุดท้าย: ระลอกน้ำ เปลวไฟ เสียงกระซิบแห่งความหวัง สายแห่งความใจดี เงาสะท้อนแห่งความขอบคุณ และสายน้ำที่แบ่งปันกัน เมื่อรวมกันแล้วคือหัวใจแห่งดวงจันทร์ ที่ส่องสว่างได้เพราะพวกเราทุกคน"
      }
    },
    "id": "roi_et"
  }
];
