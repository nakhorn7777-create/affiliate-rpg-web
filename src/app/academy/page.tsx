import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";
import AcademyView, {
  type AcademyQuest,
  type JustCompletedQuest,
} from "./academy-view";

export default async function AcademyPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();

  const [{ data: claimed }, { data: quests }, { data: progress }] =
    await Promise.all([
      supabase.rpc("check_and_claim_academy_quests"),
      supabase
        .from("academy_quests")
        .select(
          "id, quest_key, title, description, sort_order, reward_currency, reward_item_id, reward_item_quantity, game_items(name)"
        )
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("academy_quest_progress")
        .select("quest_id, completed_at")
        .eq("user_id", user.id),
    ]);

  const completedAtByQuestId = new Map(
    (progress ?? []).map((row) => [row.quest_id, row.completed_at as string])
  );

  const questList: AcademyQuest[] = (quests ?? []).map((quest) => {
    const itemRelation = Array.isArray(quest.game_items)
      ? quest.game_items[0] ?? null
      : quest.game_items;

    return {
      id: quest.id,
      quest_key: quest.quest_key,
      title: quest.title,
      description: quest.description,
      sort_order: quest.sort_order,
      reward_currency: quest.reward_currency,
      reward_item_id: quest.reward_item_id,
      reward_item_quantity: quest.reward_item_quantity,
      reward_item_name: itemRelation?.name ?? null,
      completed: completedAtByQuestId.has(quest.id),
      completed_at: completedAtByQuestId.get(quest.id) ?? null,
    };
  });

  const itemNameByQuestKey = new Map(
    questList.map((quest) => [quest.quest_key, quest.reward_item_name])
  );

  type ClaimedQuestRow = {
    quest_key: string;
    title: string;
    reward_currency: number;
    reward_item_id: string | null;
    reward_item_quantity: number;
  };

  const justCompleted: JustCompletedQuest[] = ((claimed ?? []) as ClaimedQuestRow[]).map(
    (row) => ({
      quest_key: row.quest_key,
      title: row.title,
      reward_currency: row.reward_currency,
      reward_item_quantity: row.reward_item_quantity,
      reward_item_name: row.reward_item_id
        ? itemNameByQuestKey.get(row.quest_key) ?? null
        : null,
    })
  );

  return <AcademyView quests={questList} justCompleted={justCompleted} />;
}
