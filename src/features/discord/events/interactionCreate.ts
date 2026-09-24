import { MessageFlags, Events, Interaction } from 'discord.js';
import { BotClient } from '../../../bot/client';
import { LogService } from '../../../shared/logs/logs.service';
import { AppConfigService } from '../services/app-config.service';
import {
  handleGroupButton,
  handleGroupSelectMenu,
  handleGroupDescModal,
  handleGroupTimeModal,
  GROUP_BUTTON_PREFIX,
} from '../../group/events/group-interactions';
import { GROUP_DESC_MODAL_PREFIX, GROUP_TIME_MODAL_PREFIX } from '../../group/services/group-ui.service';
import { GROUP_NOTIFS_SELECT_ID } from '../../group/slash/group-notifs';
import { VOC_CONFIG_BUTTON_ID, VOC_INVITE_USER_SELECT_ID } from '../../voice/services/voice.service';
import {
  handleVocConfigButton,
  handleVocConfigModal,
  handleVocInviteUserSelect,
  VOC_CONFIG_MODAL_ID
} from '../../voice/interactions/vocConfigHandler';
import { MONEY_MODAL_PREFIX } from '../../admin/slash/money';
import giveExpeditionCommand, { GIVE_EXPEDITION_BUTTON_PREFIX, GIVE_EXPEDITION_MODAL_PREFIX } from '../../peak-hunters/slash/give-expedition';
import { EMBED_EDIT_MODAL_PREFIX } from '../../admin/slash/embed';
import { handleExpeditionButton } from '../../peak-hunters/slash/subcommands/expedition';
import { SpawnService, SPAWN_BUTTON_PREFIX } from '../../peak-hunters/services/spawn.service';
import { PeakHuntersPlugin, VOICE_CHECK_BUTTON_PREFIX } from '../../peak-hunters/services/peak-hunters.plugin';
import {
  INV_BUTTON_PREFIX,
  handleInventaireButton,
} from '../../peak-hunters/slash/subcommands/inv';
import { HOME_BUTTON_PREFIX, handleHomeButton, MAP_BUTTON_PREFIX, handleMapButton } from '../../peak-hunters/slash/subcommands/home';
import {
  handleImpostorButtonInteraction,
  handleImpostorSelectMenu,
  handleImpostorModalSubmit,
} from '../../impostor/events/impostor-interactions';
import {
  handleBetButton,
  handleBetSelectMenu,
  handleBetPlaceSelect,
  handleBetSetupModal,
  handleBetPlaceModal,
} from '../../bet/events/bet-interactions';
import {
  handleDraftButton,
  handleDraftUserSelect,
  handleDraftStringSelect,
} from '../../draft/events/draft-interactions';
import { EnigmeService } from '../../arcade/enigme/services/enigme.service';
import { ENIGME_BUTTON_ID, ENIGME_HINT_BUTTON_ID, ENIGME_MODAL_ID, ENIGME_REVEAL_BUTTON_ID } from '../../arcade/enigme/constants/enigme.constants';
import { QuizService, QUIZ_BUTTON_PREFIX, QUIZ_THEME_PREFIX } from '../../quiz/services/quiz.service';
import { PersonalityTestService, PTEST_BUTTON_PREFIX } from '../../personality-test/services/personality-test.service';
import { handleShopButton, handleShopSelect, SHOP_PREFIX } from '../../shop/events/shop-interactions';
import { handlePackButton, PACK_BUTTON_PREFIX } from '../../peak-hunters/services/pack.service';
import { isSilentDiscordError } from '../../../shared/utils/discord-errors';
const PROFILE_MODAL_ID = 'profile-config-modal';

export default {
  name: Events.InteractionCreate,
  once: false,

  async execute(client: BotClient, interaction: Interaction) {
    try {
      if (interaction.isAutocomplete()) {
        const command = client.slashCommands.get(interaction.commandName);
        if (!command?.autocomplete) return;
        try {
          await command.autocomplete(interaction);
        } catch (error) {
          console.error('Erreur lors de l\'autocomplétion:', error);
        }
      }

      else if (interaction.isCommand() || interaction.isUserContextMenuCommand() || interaction.isMessageContextMenuCommand()) {
        const command = client.slashCommands.get(interaction.commandName.toLowerCase());
        if (!command) return;
        try {
          const commandChannels = await AppConfigService.getCommandChannels();
          const allowedChannelId = commandChannels[interaction.commandName.toLowerCase()];
          if (allowedChannelId && interaction.channelId !== allowedChannelId) {
            await interaction.reply({ content: `Cette commande est réservée au channel <#${allowedChannelId}>.`, flags: MessageFlags.Ephemeral });
            return;
          }
          await command.execute(interaction, client);
          await LogService.record({
            level: 'info',
            kind: 'command',
            title: `/${interaction.commandName}`,
            userId: interaction.user.id,
            channelId: interaction.channelId ?? undefined,
            message: `<@${interaction.user.id}> a utilisé \`/${interaction.commandName}\` dans <#${interaction.channelId}>`,
          });
        } catch (error) {
          if (isSilentDiscordError(error)) return;
          console.error(`[InteractionCreate] Erreur dans /${interaction.commandName}:`, error);
          if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'Une erreur est survenue lors de l\'exécution de cette commande.', flags: MessageFlags.Ephemeral }).catch(() => {});
          } else {
            await interaction.reply({ content: 'Une erreur est survenue lors de l\'exécution de cette commande.', flags: MessageFlags.Ephemeral }).catch(() => {});
          }
        }
      }

      else if (interaction.isButton()) {
        if (interaction.customId.startsWith(GROUP_BUTTON_PREFIX + ':')) {
          await handleGroupButton(interaction, client);
        } else if (interaction.customId.startsWith('leaderboard_')) {
          const leaderboardCommand = client.slashCommands.get('leaderboard');
          if (leaderboardCommand && typeof leaderboardCommand.handleButtonInteraction === 'function') {
            await leaderboardCommand.handleButtonInteraction(interaction, client);
          }
        } else if (interaction.customId.startsWith(VOC_CONFIG_BUTTON_ID)) {
          await handleVocConfigButton(interaction, client);
        } else if (interaction.customId.startsWith(MAP_BUTTON_PREFIX + ':')) {
          await handleMapButton(interaction);
        } else if (interaction.customId.startsWith(HOME_BUTTON_PREFIX + ':')) {
          await handleHomeButton(interaction, client);
        } else if (interaction.customId.startsWith('mountain:expe:')) {
          await handleExpeditionButton(interaction, client);
        } else if (interaction.customId.startsWith(PACK_BUTTON_PREFIX + ':')) {
          await handlePackButton(interaction);
        } else if (interaction.customId.startsWith(SPAWN_BUTTON_PREFIX + ':')) {
          await SpawnService.handleClaim(interaction, client);
        } else if (interaction.customId.startsWith(VOICE_CHECK_BUTTON_PREFIX + ':')) {
          await PeakHuntersPlugin.handleVoiceCheck(interaction);
        } else if (interaction.customId.startsWith(INV_BUTTON_PREFIX + ':')) {
          await handleInventaireButton(interaction, client);
        } else if (interaction.customId.startsWith(SHOP_PREFIX + ':')) {
          await handleShopButton(interaction);
        } else if (interaction.customId.startsWith('impostor_')) {
          await handleImpostorButtonInteraction(interaction, client);
        } else if (interaction.customId.startsWith('bet:')) {
          await handleBetButton(interaction, client);
        } else if (interaction.customId.startsWith('draft:')) {
          await handleDraftButton(interaction, client);
        } else if (interaction.customId.startsWith(QUIZ_BUTTON_PREFIX + ':')) {
          await QuizService.handleAnswer(client, interaction);
        } else if (interaction.customId.startsWith(QUIZ_THEME_PREFIX + ':')) {
          await QuizService.handleThemePick(client, interaction);
        } else if (interaction.customId === ENIGME_REVEAL_BUTTON_ID) {
          await EnigmeService.handleReveal(interaction);
        } else if (interaction.customId === ENIGME_HINT_BUTTON_ID) {
          await EnigmeService.handleHint(interaction);
        } else if (interaction.customId === ENIGME_BUTTON_ID) {
          await EnigmeService.handleButton(interaction);
        } else if (interaction.customId.startsWith(PTEST_BUTTON_PREFIX + ':')) {
          await PersonalityTestService.handleButton(client, interaction);
        } else if (interaction.customId.startsWith(GIVE_EXPEDITION_BUTTON_PREFIX)) {
          await giveExpeditionCommand.handleButton(interaction, client);
        }
      }

      else if (interaction.isStringSelectMenu()) {
        if (interaction.customId === GROUP_NOTIFS_SELECT_ID) {
          const groupNotifsCommand = client.slashCommands.get('group-notifs');
          if (groupNotifsCommand?.handleSelect) await groupNotifsCommand.handleSelect(interaction, client);
        } else if (interaction.customId.startsWith(GROUP_BUTTON_PREFIX + ':')) {
          await handleGroupSelectMenu(interaction, client);
        } else if (interaction.customId.startsWith('bet:winner:')) {
          await handleBetSelectMenu(interaction, client);
        } else if (interaction.customId.startsWith('bet:place:')) {
          await handleBetPlaceSelect(interaction, client);
        } else if (interaction.customId.startsWith('draft:pick:')) {
          await handleDraftStringSelect(interaction, client);
        } else if (interaction.customId.startsWith(SHOP_PREFIX + ':')) {
          await handleShopSelect(interaction);
        } else if (interaction.customId.startsWith('impostor_')) {
          await handleImpostorSelectMenu(interaction, client);
        }
      }

      else if (interaction.isUserSelectMenu()) {
        if (interaction.customId.startsWith(VOC_INVITE_USER_SELECT_ID)) {
          await handleVocInviteUserSelect(interaction, client);
        } else if (interaction.customId.startsWith('draft:')) {
          await handleDraftUserSelect(interaction, client);
        }
      }

      else if (interaction.isModalSubmit()) {
        if (interaction.customId === ENIGME_MODAL_ID) {
          await EnigmeService.handleModal(interaction);
        } else if (interaction.customId.startsWith(GROUP_DESC_MODAL_PREFIX + ':')) {
          await handleGroupDescModal(interaction);
        } else if (interaction.customId.startsWith(GROUP_TIME_MODAL_PREFIX + ':')) {
          await handleGroupTimeModal(interaction);
        } else if (interaction.customId === PROFILE_MODAL_ID) {
          const profileCommand = client.slashCommands.get('profil');
          if (profileCommand && typeof profileCommand.handleModal === 'function') {
            await profileCommand.handleModal(interaction);
          }
        } else if (interaction.customId.startsWith(VOC_CONFIG_MODAL_ID)) {
          await handleVocConfigModal(interaction, client);
        } else if (interaction.customId.startsWith(MONEY_MODAL_PREFIX)) {
          const moneyCommand = client.slashCommands.get('gérer l\'argent');
          if (moneyCommand?.handleModalSubmit) {
            await moneyCommand.handleModalSubmit(interaction, client);
          }
        } else if (interaction.customId.startsWith(GIVE_EXPEDITION_MODAL_PREFIX)) {
          await giveExpeditionCommand.handleModalSubmit(interaction, client);
        } else if (interaction.customId.startsWith('impostor_createmodal_')) {
          await handleImpostorModalSubmit(interaction, client);
        } else if (interaction.customId.startsWith('bet:setup_modal:')) {
          await handleBetSetupModal(interaction, client);
        } else if (interaction.customId.startsWith('bet:place_modal:')) {
          await handleBetPlaceModal(interaction, client);
        } else if (interaction.customId.startsWith(EMBED_EDIT_MODAL_PREFIX)) {
          const embedCommand = client.slashCommands.get('embed');
          if (embedCommand?.handleEditModal) await embedCommand.handleEditModal(interaction, client);
        } else if (interaction.customId.startsWith(PTEST_BUTTON_PREFIX + ':')) {
          await PersonalityTestService.handleModal(client, interaction);
        }
      }
    } catch (error) {
      if (isSilentDiscordError(error)) return;
      console.error('[InteractionCreate] Erreur non gérée:', error);
    }
  }
};
