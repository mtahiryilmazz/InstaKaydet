import fs from 'fs';
import path from 'path';

const dkData = {
  data: {
    user: {
      id: "41371520611",
      username: "dkabcikpsslianne",
      full_name: "Dkab öğretmeni",
      biography: "📚 DKAB & İHL Meslek Dersleri & KPSS Hazırlık\n🎯 Günlük soru çözümleri, özet ders notları ve PDF arşivleri\n📩 İletişim & Dökümanlar için takipte kalın",
      profile_pic_url: "/images/dkabcikpsslianne/avatar.jpg",
      profile_pic_url_hd: "/images/dkabcikpsslianne/avatar.jpg",
      is_verified: false,
      is_private: false,
      edge_followed_by: {
        count: 42900
      },
      edge_follow: {
        count: 3133
      },
      edge_owner_to_timeline_media: {
        count: 522,
        page_info: {
          has_next_page: true,
          end_cursor: "QVFDRUxoRzVkazFwZml5aGpnRVRlQW1Xb3ZvbEZyMUpDNHNqSE9HMDZ6Wnlv",
          total_count: 522
        },
        edges: [
          {
            node: {
              id: "347891234001",
              shortcode: "DBK9m_1",
              display_url: "/images/dkabcikpsslianne/post_1.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728896400,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "📖 DKAB & İHL Alan Bilgisi: Tefsir Tarihi ve Usulü Hap Bilgiler Serisi 1. Bölüm. Sınavda çıkabilecek önemli kavramlar ve soru kalıpları derlendi. Kaydetmeyi unutmayın! #dkab #oabt #kpss2026 #tefsir #ihl"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1420 },
              edge_media_to_comment: { count: 86 }
            }
          },
          {
            node: {
              id: "347891234002",
              shortcode: "DBK9m_2",
              display_url: "/images/dkabcikpsslianne/post_2_1.jpg",
              is_video: false,
              __typename: "GraphSidecar",
              taken_at_timestamp: 1728810000,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "✨ Hadis Usulü Kavramları: Ravilerin Adalet ve Zabt Nitelikleri, Mütevatir, Meşhur ve Âhad Hadisler. ÖABT DKAB sınavında her yıl en az 2 soru gelen bu 3 parçalık albümü mutlaka kaydedin. #hadis #oabt #kpss #dersnotu"
                    }
                  }
                ]
              },
              edge_sidecar_to_children: {
                edges: [
                  {
                    node: {
                      id: "347891234002_c1",
                      display_url: "/images/dkabcikpsslianne/post_2_1.jpg",
                      is_video: false
                    }
                  },
                  {
                    node: {
                      id: "347891234002_c2",
                      display_url: "/images/dkabcikpsslianne/post_2_2.jpg",
                      is_video: false
                    }
                  },
                  {
                    node: {
                      id: "347891234002_c3",
                      display_url: "/images/dkabcikpsslianne/post_2_3.jpg",
                      is_video: false
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 2180 },
              edge_media_to_comment: { count: 142 }
            }
          },
          {
            node: {
              id: "347891234003",
              shortcode: "DBK9m_3",
              display_url: "/images/dkabcikpsslianne/post_3.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728723600,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "🕌 Fıkıh & İslam Hukuku: Oruçta Niyet Vakitleri ve Kefaretler tablosu. Ramazan, kaza ve adak oruçlarında niyet vakitlerinin farkları. #fikih #kpss #oabt #dhbt"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 980 },
              edge_media_to_comment: { count: 45 }
            }
          },
          {
            node: {
              id: "347891234004",
              shortcode: "DBK9m_4",
              display_url: "/images/dkabcikpsslianne/post_4.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728637200,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "🌏 Dinler Tarihi: Doğu Dinleri (Hinduizm, Budizm, Jainizm) Önemli Karşılaştırmalar tablosu. Nirvana, Karma, Ahimsa ve Mokşa kavramları. #dinlertarihi #oabt #kpss"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1650 },
              edge_media_to_comment: { count: 112 }
            }
          },
          {
            node: {
              id: "347891234005",
              shortcode: "DBK9m_5",
              display_url: "/images/dkabcikpsslianne/post_5.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728550800,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "⚖️ Kelam ve Mezhepler Tarihi: Büyük Günah (Mürtekib-i Kebire) ve İman-Amel ilişkisi. Hariciler, Mu'tezile, Mürcie ve Ehl-i Sünnet görüşleri. #kelam #mezheplertarihi #oabt"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1310 },
              edge_media_to_comment: { count: 73 }
            }
          },
          {
            node: {
              id: "347891234006",
              shortcode: "DBK9m_6",
              display_url: "/images/dkabcikpsslianne/post_6.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728464400,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "🏛️ İslam Medeniyeti ve Kurumları: Beytü'l-Hikme ve Nizamiye Medreseleri. İslam bilim tarihi öncüleri İbn Heysem, Biruni ve Harezmi. #islamtarihi #medeniyet"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1190 },
              edge_media_to_comment: { count: 62 }
            }
          },
          {
            node: {
              id: "347891234007",
              shortcode: "DBK9m_7",
              display_url: "/images/dkabcikpsslianne/post_7.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728378000,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "🧠 Din Psikolojisi ve Alan Eğitimi: Yaş dönemlerine göre dini gelişim ve tutumlar. Fowler inanç evreleri ve MEB öğretim programı kazanımları. #dinpsikolojisi #alansinavi"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1440 },
              edge_media_to_comment: { count: 88 }
            }
          },
          {
            node: {
              id: "347891234008",
              shortcode: "DBK9m_8",
              display_url: "/images/dkabcikpsslianne/post_8.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728291600,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "📖 Kur'an İlimleri ve Tecvid Kuralları: Mahreçler, Sıfatlar ve İdğam Çeşitleri şeması. Sınavda en çok karıştırılan Tecvid kuralları. #tecvid #kuran #dhbt"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1890 },
              edge_media_to_comment: { count: 134 }
            }
          },
          {
            node: {
              id: "347891234009",
              shortcode: "DBK9m_9",
              display_url: "/images/dkabcikpsslianne/post_9.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728205200,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "📜 İslam Felsefesi ve Mantık: Kindi, Farabi, İbn Sina ve Gazali'nin temel eserleri ve felsefi tezleri. #felsefe #mantik #oabt"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 970 },
              edge_media_to_comment: { count: 51 }
            }
          },
          {
            node: {
              id: "347891234010",
              shortcode: "DBK9m_10",
              display_url: "/images/dkabcikpsslianne/post_10.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728118800,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "📝 Günün ÖABT / DHBT Deneme Sorusu ve Çözümü: Nikah ve mehir fıkhı soru analizi. #deneme #sorucozumu #kpss2026"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 2150 },
              edge_media_to_comment: { count: 198 }
            }
          },
          {
            node: {
              id: "347891234011",
              shortcode: "DBK9m_11",
              display_url: "/images/dkabcikpsslianne/post_11.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1728032400,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "🎯 KPSS 2026 Genel Tekrar Bülteni: Sınava hazırlık sürecinde kritik 5 altın kural ve haftalık çalışma planı. #kpss2026 #geneltekrar #rehberlik"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 2430 },
              edge_media_to_comment: { count: 220 }
            }
          },
          {
            node: {
              id: "347891234012",
              shortcode: "DBK9m_12",
              display_url: "/images/dkabcikpsslianne/post_12.jpg",
              is_video: false,
              __typename: "GraphImage",
              taken_at_timestamp: 1727946000,
              edge_media_to_caption: {
                edges: [
                  {
                    node: {
                      text: "✍️ Arapça & Gramer Kuralları: İ'rab, Merfûât, Mansûbât ve Mecrûrât Özet Tablosu. Cümle tahlili ve fiil çekimleri. #arapca #gramer #ihl"
                    }
                  }
                ]
              },
              edge_media_preview_like: { count: 1780 },
              edge_media_to_comment: { count: 114 }
            }
          }
        ]
      }
    }
  }
};

const jsonStr = JSON.stringify(dkData, null, 2);

const targets = [
  path.join(process.cwd(), 'src', 'data', 'dkabcikpsslianne.json'),
  path.join(process.cwd(), 'public', 'data', 'dkabcikpsslianne.json'),
  path.join(process.cwd(), '.cache', 'instagram', 'dkabcikpsslianne.json')
];

targets.forEach(t => {
  const dir = path.dirname(t);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(t, jsonStr, 'utf-8');
  console.log(`Saved pristine dkabcikpsslianne.json to ${t}`);
});
